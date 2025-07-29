import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, requestUrl, Modal, TFolder } from 'obsidian';

interface DifySyncSettings {
	difyApiKey: string;
	difyKnowledgeId: string;
	difyApiUrl: string;
	obsidianFolders: string[];
	autoSyncEnabled: boolean;
	syncInterval: number;
	lastSyncTime: string;
}

const DEFAULT_SETTINGS: DifySyncSettings = {
	difyApiKey: '',
	difyKnowledgeId: '',
	difyApiUrl: 'http://localhost:5000',
	obsidianFolders: [],
	autoSyncEnabled: false,
	syncInterval: 30,
	lastSyncTime: ''
};

interface FileHash {
	path: string;
	hash: string;
	lastModified: number;
}

export default class DifySyncPlugin extends Plugin {
	settings: DifySyncSettings;
	syncIntervalId: number;
	statusBarItem: HTMLElement;
	fileHashes: Map<string, FileHash> = new Map();
	private readonly HASH_FILE_NAME = 'historyContentHash';
	private syncProgressNotice: Notice | null = null;

	async onload() {
		await this.loadSettings();
		
		// 等待 vault 完全加载
		this.app.workspace.onLayoutReady(async () => {
			console.log('Vault布局准备完成，开始加载hash数据');
			await this.migrateHashStorage(); // 先尝试迁移旧数据
			await this.loadFileHashes();
			console.log(`最终加载的hash记录数量: ${this.fileHashes.size}`);
		});

		// Add ribbon icon for manual sync
		const ribbonIconEl = this.addRibbonIcon('sync', 'Dify Sync', async () => {
			await this.performSync();
		});
		ribbonIconEl.addClass('dify-sync-ribbon-class');

		// Add status bar item
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar('Ready');

		// Add command for manual sync
		this.addCommand({
			id: 'dify-sync-manual',
			name: 'Sync to Dify Knowledge Base',
			callback: async () => {
				await this.performSync();
			}
		});

		// Add command to toggle auto sync
		this.addCommand({
			id: 'dify-sync-toggle-auto',
			name: 'Toggle Auto Sync',
			callback: async () => {
				this.settings.autoSyncEnabled = !this.settings.autoSyncEnabled;
				await this.saveSettings();
				this.setupAutoSync();
				new Notice(`Auto sync ${this.settings.autoSyncEnabled ? 'enabled' : 'disabled'}`);
			}
		});

		// Add settings tab
		this.addSettingTab(new DifySyncSettingTab(this.app, this));

		// Setup auto sync if enabled
		this.setupAutoSync();
	}

	onunload() {
		if (this.syncIntervalId) {
			window.clearInterval(this.syncIntervalId);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadFileHashes() {
		try {
			console.log(`尝试加载hash文件: ${this.HASH_FILE_NAME}`);
			
			// 先检查文件是否存在
			const hashFile = this.app.vault.getAbstractFileByPath(this.HASH_FILE_NAME);
			console.log('文件查找结果:', hashFile ? '找到文件' : '文件不存在');
			
			if (hashFile && hashFile instanceof TFile) {
				console.log(`文件大小: ${hashFile.stat.size} bytes`);
				console.log(`文件修改时间: ${new Date(hashFile.stat.mtime).toLocaleString()}`);
				
				const content = await this.app.vault.read(hashFile);
				console.log(`文件内容长度: ${content.length}`);
				console.log(`文件内容预览: ${content.substring(0, 200)}...`);
				
				if (content.trim()) {
					try {
						const hashData = JSON.parse(content);
						console.log('JSON解析成功，数据键数量:', Object.keys(hashData).length);
						
						const hashEntries = Object.entries(hashData) as [string, FileHash][];
						this.fileHashes = new Map(hashEntries);
						console.log(`成功加载 ${this.fileHashes.size} 个文件的hash记录`);
						
						// 显示前几个记录作为验证
						let count = 0;
						for (const [path, hash] of this.fileHashes) {
							if (count < 3) {
								console.log(`  - ${path}: ${hash.hash} (${new Date(hash.lastModified).toLocaleString()})`);
								count++;
							}
						}
					} catch (parseError) {
						console.error('JSON解析失败:', parseError);
						console.log('尝试解析的内容:', content);
						this.fileHashes = new Map();
					}
				} else {
					console.log('Hash文件为空，初始化为空Map');
					this.fileHashes = new Map();
				}
			} else {
				console.log('Hash文件不存在，初始化为空Map');
				this.fileHashes = new Map();
			}
		} catch (error) {
			console.error('加载hash文件时出错:', error);
			this.fileHashes = new Map();
		}
	}

	async saveFileHashes() {
		try {
			// Convert Map to object for storage
			const hashObject: Record<string, FileHash> = {};
			this.fileHashes.forEach((value, key) => {
				hashObject[key] = value;
			});
			
			const content = JSON.stringify(hashObject, null, 2);
			console.log(`准备保存 ${this.fileHashes.size} 个文件的hash记录到 ${this.HASH_FILE_NAME}`);
			
			// Check if hash file exists
			const existingFile = this.app.vault.getAbstractFileByPath(this.HASH_FILE_NAME);
			if (existingFile && existingFile instanceof TFile) {
				// Update existing file
				await this.app.vault.modify(existingFile, content);
				console.log(`成功更新hash文件: ${this.HASH_FILE_NAME}`);
			} else {
				// Create new file in workspace root
				await this.app.vault.create(this.HASH_FILE_NAME, content);
				console.log(`成功创建hash文件: ${this.HASH_FILE_NAME}`);
			}
		} catch (error) {
			console.error('保存hash文件失败:', error);
			new Notice('❌ Failed to save sync history: ' + error.message);
		}
	}

	async migrateHashStorage() {
		try {
			// Check if hash file already exists in workspace root
			const hashFile = this.app.vault.getAbstractFileByPath(this.HASH_FILE_NAME);
			if (hashFile) {
				// Hash file already exists, no migration needed
				return;
			}

			// Try to load old hash data from plugin data
			const data = await this.loadData();
			if (data && data.fileHashes) {
				
				// Convert old data to new format
				const hashEntries = Object.entries(data.fileHashes) as [string, FileHash][];
				this.fileHashes = new Map(hashEntries);
				
				// Save to new location
				await this.saveFileHashes();
				
				// Clean up old data
				delete data.fileHashes;
				await this.saveData(data);
				
				new Notice('✅ Hash storage migrated to workspace file');
			}
		} catch (error) {
			// Migration failure is not critical, continue with empty hashes
		}
	}

	setupAutoSync() {
		// Clear existing interval
		if (this.syncIntervalId) {
			window.clearInterval(this.syncIntervalId);
		}

		// Setup new interval if auto sync is enabled
		if (this.settings.autoSyncEnabled && this.settings.syncInterval > 0) {
			this.syncIntervalId = window.setInterval(async () => {
				await this.performSync();
			}, this.settings.syncInterval * 60 * 1000);
		}
	}

	updateStatusBar(message: string, isError: boolean = false) {
		const now = new Date().toLocaleTimeString();
		(this.statusBarItem as any).setText(`Dify: ${message} (${now})`);
		
		if (isError) {
			(this.statusBarItem as any).addClass('dify-sync-error');
		} else {
			(this.statusBarItem as any).removeClass('dify-sync-error');
		}
	}

	async performSync() {
		if (!this.validateSettings()) {
			return;
		}

		// Show simple sync notice
		this.showSyncNotice('🔄 正在同步到知识库...');
		this.updateStatusBar('Syncing...', false);
		
		try {
			const files = this.app.vault.getMarkdownFiles();
			let syncedCount = 0;
			let skippedCount = 0;

			// Process files
			for (const file of files) {
				// Check if file is in specified folders (if any are set)
				if (this.settings.obsidianFolders.length > 0) {
					const isInSelectedFolder = this.settings.obsidianFolders.some(folder => 
						folder === '' || file.path.startsWith(folder + '/') || file.path === folder
					);
					if (!isInSelectedFolder) {
						continue;
					}
				}
				
				const shouldSync = await this.shouldSyncFile(file);
				if (shouldSync) {
					await this.checkAndUpdateDocument(file);
					syncedCount++;
				} else {
					skippedCount++;
				}
			}

			// Save settings and hashes
			this.settings.lastSyncTime = new Date().toISOString();
			await this.saveSettings();
			await this.saveFileHashes();

			// Show completion
			const message = `Synced ${syncedCount} files, skipped ${skippedCount}`;
			this.updateStatusBar(message);
			this.showSyncComplete(`✅ ${message}`, syncedCount, skippedCount);

		} catch (error) {
			const errorMessage = `Sync failed: ${error.message}`;
			this.updateStatusBar(errorMessage, true);
			this.showSyncError(`❌ ${errorMessage}`);
		}
	}

	showSyncProgress(message: string, current: number, total: number) {
		const progress = total > 0 ? Math.round((current / total) * 100) : 0;
		const progressBar = this.createProgressBar(progress);
		const content = `${message}\n${progressBar} ${progress}% (${current}/${total})`;
		
		// If notice doesn't exist, create it
		if (!this.syncProgressNotice) {
			this.syncProgressNotice = new Notice(content, 0); // Don't auto-hide
			
			// Style the notice for better visibility
			if (this.syncProgressNotice.noticeEl) {
				this.syncProgressNotice.noticeEl.addClass('dify-sync-progress');
			}
		} else {
			// Update existing notice content
			if (this.syncProgressNotice.noticeEl) {
				const textElement = this.syncProgressNotice.noticeEl.querySelector('.notice-text');
				if (textElement) {
					textElement.textContent = content;
				}
			}
		}
	}

	showSyncNotice(message: string) {
		// If notice doesn't exist, create it
		if (!this.syncProgressNotice) {
			this.syncProgressNotice = new Notice(message, 0); // Don't auto-hide
			
			// Style the notice for better visibility
			if (this.syncProgressNotice.noticeEl) {
				this.syncProgressNotice.noticeEl.addClass('dify-sync-progress');
			}
		} else {
			// Update existing notice content
			if (this.syncProgressNotice.noticeEl) {
				const textElement = this.syncProgressNotice.noticeEl.querySelector('.notice-text');
				if (textElement) {
					textElement.textContent = message;
				}
			}
		}
	}

	showSyncComplete(message: string, synced: number, skipped: number) {
		// Close progress notice
		if (this.syncProgressNotice) {
			this.syncProgressNotice.hide();
			this.syncProgressNotice = null;
		}

		// Show completion notice with details
		const detailMessage = `${message}\n📊 Details: ${synced} synced, ${skipped} unchanged`;
		const completeNotice = new Notice(detailMessage, 5000);
		
		if (completeNotice.noticeEl) {
			completeNotice.noticeEl.addClass('dify-sync-complete');
		}
	}

	showSyncError(message: string) {
		// Close progress notice
		if (this.syncProgressNotice) {
			this.syncProgressNotice.hide();
			this.syncProgressNotice = null;
		}

		// Show error notice
		const errorNotice = new Notice(message, 8000);
		
		if (errorNotice.noticeEl) {
			errorNotice.noticeEl.addClass('dify-sync-error-notice');
		}
	}

	createProgressBar(percentage: number): string {
		const barLength = 20;
		const filledLength = Math.round((percentage / 100) * barLength);
		const emptyLength = barLength - filledLength;
		
		const filled = '█'.repeat(filledLength);
		const empty = '░'.repeat(emptyLength);
		
		return `[${filled}${empty}]`;
	}

	validateSettings(): boolean {
		if (!this.settings.difyApiKey) {
			new Notice('❌ Dify API Key not configured');
			return false;
		}
		if (!this.settings.difyKnowledgeId) {
			new Notice('❌ Dify Knowledge ID not configured');
			return false;
		}
		if (!this.settings.difyApiUrl) {
			new Notice('❌ Dify API URL not configured');
			return false;
		}
		return true;
	}

	async shouldSyncFile(file: TFile): Promise<boolean> {
		const content = await this.app.vault.read(file);
		const hash = this.simpleHash(content);
		
		const existingHash = this.fileHashes.get(file.path);
		
		console.log(`检查文件: ${file.path}`);
		console.log(`当前hash: ${hash}`);
		console.log(`当前修改时间: ${file.stat.mtime}`);
		console.log(`存储的hash记录:`, existingHash);
		
		if (!existingHash) {
			console.log(`文件 ${file.path} 没有hash记录 - 需要同步`);
			return true;
		}
		
		if (existingHash.hash !== hash) {
			console.log(`文件 ${file.path} hash不匹配 - 需要同步`);
			return true;
		}
		
		if (existingHash.lastModified !== file.stat.mtime) {
			console.log(`文件 ${file.path} 修改时间不匹配 - 需要同步`);
			return true;
		}
		
		console.log(`文件 ${file.path} 未改变 - 跳过同步`);
		return false;
	}

	// Simple hash function to replace crypto dependency
	simpleHash(str: string): string {
		let hash = 0;
		if (str.length === 0) return hash.toString();
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return Math.abs(hash).toString(16);
	}

	async syncFileToKnowledgeBase(file: TFile) {
		const content = await this.app.vault.read(file);
		
		// Create document in Dify knowledge base using correct API endpoint
		const url = `${this.settings.difyApiUrl}/v1/datasets/${this.settings.difyKnowledgeId}/document/create_by_text`;
		
		const requestBody = {
			name: file.name,
			text: content,
			indexing_technique: 'high_quality',
			process_rule: {
				mode: 'automatic'
			}
		};

		try {
			const response = await requestUrl({
				url: url,
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.settings.difyApiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (response.status !== 200 && response.status !== 201) {
				throw new Error(`HTTP ${response.status}: ${response.text || 'Unknown error'}`);
			}
		} catch (error) {
			throw new Error(`Failed to sync ${file.name}: ${error.message}`);
		}
	}

	// Add method to check if document already exists and update instead of create
	async checkAndUpdateDocument(file: TFile) {
		const content = await this.app.vault.read(file);
		
		try {
			// First, try to get the list of documents to see if this file already exists
			const listUrl = `${this.settings.difyApiUrl}/v1/datasets/${this.settings.difyKnowledgeId}/documents`;
			const listResponse = await requestUrl({
				url: listUrl,
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.settings.difyApiKey}`,
				}
			});

			if (listResponse.status === 200) {
				const documents = JSON.parse(listResponse.text);
				const existingDoc = documents.data?.find((doc: any) => doc.name === file.name);
				
				if (existingDoc) {
					// Document exists, update it
					const updateUrl = `${this.settings.difyApiUrl}/v1/datasets/${this.settings.difyKnowledgeId}/documents/${existingDoc.id}/update_by_text`;
					const updateBody = {
						name: file.name,
						text: content
					};

					const updateResponse = await requestUrl({
						url: updateUrl,
						method: 'POST',
						headers: {
							'Authorization': `Bearer ${this.settings.difyApiKey}`,
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(updateBody)
					});

					if (updateResponse.status !== 200 && updateResponse.status !== 201) {
						throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.text || 'Unknown error'}`);
					}
					
					// Update hash record only after successful sync
					this.updateFileHash(file, content);
					return;
				}
			}
			
			// Document doesn't exist, create new one
			await this.syncFileToKnowledgeBase(file);
			// Update hash record only after successful sync
			this.updateFileHash(file, content);
			
		} catch (error) {
			// If checking fails, fall back to creating new document
			await this.syncFileToKnowledgeBase(file);
			// Update hash record only after successful sync
			this.updateFileHash(file, content);
		}
	}

	updateFileHash(file: TFile, content: string) {
		const hash = this.simpleHash(content);
		this.fileHashes.set(file.path, {
			path: file.path,
			hash: hash,
			lastModified: file.stat.mtime
		});
	}
}

class MultiFolderSelectorModal extends Modal {
	folders: string[];
	selectedFolders: Set<string>;
	onConfirm: (selectedFolders: string[]) => void;
	folderElements: Map<string, HTMLElement> = new Map();
	folderHierarchy: Map<string, string[]> = new Map(); // parent -> children mapping

	constructor(app: App, folders: string[], currentSelection: string[], onConfirm: (selectedFolders: string[]) => void) {
		super(app);
		this.folders = folders.sort(); // Sort folders to ensure proper hierarchy display
		this.selectedFolders = new Set(currentSelection);
		this.onConfirm = onConfirm;
		this.buildFolderHierarchy();
	}

	buildFolderHierarchy() {
		// Build parent-child relationships
		this.folders.forEach(folder => {
			const children: string[] = [];
			this.folders.forEach(otherFolder => {
				if (otherFolder !== folder && otherFolder.startsWith(folder + '/')) {
					// Check if it's a direct child (not a grandchild)
					const relativePath = otherFolder.substring(folder.length + 1);
					if (!relativePath.includes('/')) {
						children.push(otherFolder);
					}
				}
			});
			if (children.length > 0) {
				this.folderHierarchy.set(folder, children.sort());
			}
		});
	}

	// Get root folders (folders with no parent)
	getRootFolders(): string[] {
		return this.folders.filter(folder => {
			return !this.folders.some(otherFolder => 
				otherFolder !== folder && folder.startsWith(otherFolder + '/')
			);
		}).sort();
	}

	// Check if this is the last child of its parent
	isLastChild(folder: string): boolean {
		const parent = this.getParentFolder(folder);
		if (!parent) return true;
		
		const siblings = this.folderHierarchy.get(parent) || [];
		return siblings[siblings.length - 1] === folder;
	}

	// Get tree prefix for display (├─, └─, │, etc.)
	getTreePrefix(folder: string): string {
		const parts = folder.split('/');
		let prefix = '';
		
		for (let i = 0; i < parts.length - 1; i++) {
			const currentPath = parts.slice(0, i + 1).join('/');
			const isLastInLevel = this.isLastChild(currentPath);
			
			if (i === 0) continue; // Skip root level
			
			if (isLastInLevel) {
				prefix += '    '; // 4 spaces for completed branches
			} else {
				prefix += '│   '; // Vertical line for ongoing branches
			}
		}
		
		if (parts.length > 1) {
			const isLast = this.isLastChild(folder);
			prefix += isLast ? '└── ' : '├── ';
		}
		
		return prefix;
	}

	getParentFolder(folder: string): string | null {
		const lastSlashIndex = folder.lastIndexOf('/');
		if (lastSlashIndex === -1) return null;
		const parentPath = folder.substring(0, lastSlashIndex);
		return this.folders.includes(parentPath) ? parentPath : null;
	}

	getAllChildren(folder: string): string[] {
		const children: string[] = [];
		const directChildren = this.folderHierarchy.get(folder) || [];
		
		directChildren.forEach(child => {
			children.push(child);
			children.push(...this.getAllChildren(child)); // Recursive call for grandchildren
		});
		
		return children;
	}

	getAllParents(folder: string): string[] {
		const parents: string[] = [];
		let currentParent = this.getParentFolder(folder);
		
		while (currentParent) {
			parents.push(currentParent);
			currentParent = this.getParentFolder(currentParent);
		}
		
		return parents;
	}

	getFolderDepth(folder: string): number {
		return folder.split('/').length - 1;
	}

	toggleFolderWithHierarchy(folder: string) {
		const isCurrentlySelected = this.selectedFolders.has(folder);
		
		if (isCurrentlySelected) {
			// Deselect this folder and all its children
			this.selectedFolders.delete(folder);
			const allChildren = this.getAllChildren(folder);
			allChildren.forEach(child => {
				this.selectedFolders.delete(child);
			});
		} else {
			// Select this folder and all its children
			this.selectedFolders.add(folder);
			const allChildren = this.getAllChildren(folder);
			allChildren.forEach(child => {
				this.selectedFolders.add(child);
			});
			
			// Also check if we should select parent folders
			// If all siblings of this folder are now selected, select the parent too
			this.checkAndSelectParents(folder);
		}
		
		this.updateFolderDisplay();
	}

	checkAndSelectParents(folder: string) {
		const parent = this.getParentFolder(folder);
		if (!parent) return;
		
		// Get all direct children of the parent
		const siblings = this.folderHierarchy.get(parent) || [];
		
		// Check if all siblings are selected
		const allSiblingsSelected = siblings.every(sibling => this.selectedFolders.has(sibling));
		
		if (allSiblingsSelected && !this.selectedFolders.has(parent)) {
			this.selectedFolders.add(parent);
			// Recursively check parent's parent
			this.checkAndSelectParents(parent);
		}
	}

	toggleFolder(folder: string) {
		// Keep the old method for backward compatibility with select all/deselect all
		if (this.selectedFolders.has(folder)) {
			this.selectedFolders.delete(folder);
		} else {
			this.selectedFolders.add(folder);
		}
		this.updateFolderDisplay();
	}

	updateFolderDisplay() {
		this.folderElements.forEach((element, folder) => {
			const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
			const isSelected = this.selectedFolders.has(folder);
			
			checkbox.checked = isSelected;
			
			if (isSelected) {
				element.addClass('selected');
			} else {
				element.removeClass('selected');
			}
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		
		contentEl.createEl('h3', { text: 'Select Folders to Sync' });
		contentEl.createEl('p', { 
			text: 'Click folders to select/deselect. Empty selection means sync all folders.',
			cls: 'folder-selector-description'
		});
		
		// Add control buttons
		const controlDiv = contentEl.createDiv('folder-control-buttons');
		
		const selectAllBtn = controlDiv.createEl('button', { text: 'Select All', cls: 'mod-cta' });
		selectAllBtn.addEventListener('click', () => {
			this.folders.forEach(folder => {
				if (folder) {
					this.selectedFolders.add(folder);
				}
			});
			this.updateFolderDisplay();
		});
		
		const deselectAllBtn = controlDiv.createEl('button', { text: 'Deselect All' });
		deselectAllBtn.addEventListener('click', () => {
			this.selectedFolders.clear();
			this.updateFolderDisplay();
		});
		
		// Add folders container
		const foldersContainer = contentEl.createDiv('folders-container');
		
		// Render folders in tree structure
		this.renderFolderTree(foldersContainer);
		
		// Add action buttons
		const buttonDiv = contentEl.createDiv('modal-button-container');
		
		const confirmButton = buttonDiv.createEl('button', { text: 'Confirm Selection', cls: 'mod-cta' });
		confirmButton.addEventListener('click', () => {
			this.onConfirm(Array.from(this.selectedFolders));
			this.close();
		});
		
		const cancelButton = buttonDiv.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.close();
		});
		
		// Initial display update
		this.updateFolderDisplay();
	}

	renderFolderTree(container: HTMLElement) {
		// Start with root folders and render recursively
		const rootFolders = this.getRootFolders();
		rootFolders.forEach(folder => {
			this.renderFolderNode(container, folder);
		});
	}

	renderFolderNode(container: HTMLElement, folder: string) {
		const folderDiv = container.createDiv('folder-option multi-select tree-node');
		
		const checkbox = folderDiv.createEl('input', { type: 'checkbox' });
		checkbox.checked = this.selectedFolders.has(folder);
		
		const folderLabel = folderDiv.createEl('label', { cls: 'folder-label' });
		
		// Add tree structure prefix
		const treePrefix = this.getTreePrefix(folder);
		if (treePrefix) {
			folderLabel.createEl('span', { text: treePrefix, cls: 'tree-prefix' });
		}
		
		// Add folder icon and name
		folderLabel.createEl('span', { text: '📁 ', cls: 'folder-icon' });
		
		// Show only the folder name (not full path) for better readability
		const folderName = folder.split('/').pop() || folder;
		folderLabel.createEl('span', { text: folderName, cls: 'folder-name' });
		
		// Add children count indicator if folder has children
		const children = this.folderHierarchy.get(folder);
		if (children && children.length > 0) {
			folderLabel.createEl('span', { 
				text: ` (${children.length})`, 
				cls: 'folder-children-count' 
			});
		}
		
		// Store reference for easy updates
		this.folderElements.set(folder, folderDiv);
		
		// Add click handler for the entire div
		folderDiv.addEventListener('click', (e) => {
			e.preventDefault();
			this.toggleFolderWithHierarchy(folder);
		});
		
		// Prevent checkbox from triggering the div click
		checkbox.addEventListener('click', (e) => {
			e.stopPropagation();
			this.toggleFolderWithHierarchy(folder);
		});
		
		// Recursively render children
		if (children && children.length > 0) {
			children.forEach(child => {
				this.renderFolderNode(container, child);
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class DifySyncSettingTab extends PluginSettingTab {
	plugin: DifySyncPlugin;

	constructor(app: App, plugin: DifySyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Dify Sync Settings' });

		// Dify API Key
		new Setting(containerEl)
			.setName('Dify API Key')
			.setDesc('Your Dify API Key for authentication')
			.addText((text: any) => text
				.setPlaceholder('Enter your Dify API Key')
				.setValue(this.plugin.settings.difyApiKey)
				.onChange(async (value: string) => {
					this.plugin.settings.difyApiKey = value;
					await this.plugin.saveSettings();
				}));

		// Dify Knowledge ID
		new Setting(containerEl)
			.setName('Dify Knowledge Base ID')
			.setDesc('The ID of your Dify knowledge base')
			.addText((text: any) => text
				.setPlaceholder('Enter your knowledge base ID')
				.setValue(this.plugin.settings.difyKnowledgeId)
				.onChange(async (value: string) => {
					this.plugin.settings.difyKnowledgeId = value;
					await this.plugin.saveSettings();
				}));

		// Dify API URL
		new Setting(containerEl)
			.setName('Dify API URL')
			.setDesc('Your local Dify deployment URL')
			.addText((text: any) => text
				.setPlaceholder('http://localhost:5000')
				.setValue(this.plugin.settings.difyApiUrl)
				.onChange(async (value: string) => {
					this.plugin.settings.difyApiUrl = value;
					await this.plugin.saveSettings();
				}));

		// Obsidian Folders
		new Setting(containerEl)
			.setName('Obsidian Folders')
			.setDesc('Specific folders to sync (leave empty to sync all notes)')
			.addText((text: any) => {
				const displayText = this.plugin.settings.obsidianFolders.length === 0 
					? 'All folders' 
					: `${this.plugin.settings.obsidianFolders.length} folder(s) selected`;
				text.setPlaceholder('No folders selected')
					.setValue(displayText)
					.setDisabled(true);
			})
			.addButton((button: any) => button
				.setButtonText('Select Folders')
				.onClick(async () => {
					const folders = this.app.vault.getAllLoadedFiles()
						.filter(file => file instanceof TFolder)
						.map(folder => folder.path)
						.sort();
					
					// Create multi-folder selection modal
					const modal = new MultiFolderSelectorModal(
						this.app, 
						folders, 
						this.plugin.settings.obsidianFolders,
						async (selectedFolders: string[]) => {
							this.plugin.settings.obsidianFolders = selectedFolders;
							await this.plugin.saveSettings();
							// Update the text field to show selected folders
							const textInput = containerEl.querySelector('.obsidian-folders-input') as HTMLInputElement;
							if (textInput) {
								const displayText = selectedFolders.length === 0 
									? 'All folders' 
									: `${selectedFolders.length} folder(s) selected`;
								(textInput as any).value = displayText;
							}
						}
					);
					modal.open();
				}))
			.addButton((button: any) => button
				.setButtonText('Clear All')
				.onClick(async () => {
					this.plugin.settings.obsidianFolders = [];
					await this.plugin.saveSettings();
					// Update the text field
					const textInput = containerEl.querySelector('.obsidian-folders-input') as HTMLInputElement;
					if (textInput) {
						textInput.value = 'All folders';
					}
				}));
		
		// Add class to the text input for easier selection
		const folderSetting = containerEl.lastElementChild;
		if (folderSetting) {
			const textInput = folderSetting.querySelector('input[type="text"]') as HTMLInputElement;
			if (textInput) {
				textInput.classList.add('obsidian-folders-input');
				const displayText = this.plugin.settings.obsidianFolders.length === 0 
					? 'All folders' 
					: `${this.plugin.settings.obsidianFolders.length} folder(s) selected`;
				(textInput as any).value = displayText;
			}
		}

		// Auto Sync Toggle
		new Setting(containerEl)
			.setName('Enable Auto Sync')
			.setDesc('Automatically sync notes at regular intervals')
			.addToggle((toggle: any) => toggle
				.setValue(this.plugin.settings.autoSyncEnabled)
				.onChange(async (value: boolean) => {
					this.plugin.settings.autoSyncEnabled = value;
					await this.plugin.saveSettings();
					this.plugin.setupAutoSync();
				}));

		// Sync Interval
		new Setting(containerEl)
			.setName('Sync Interval (minutes)')
			.setDesc('How often to automatically sync (when auto sync is enabled)')
			.addSlider((slider: any) => slider
				.setLimits(5, 120, 5)
				.setValue(this.plugin.settings.syncInterval)
				.setDynamicTooltip()
				.onChange(async (value: number) => {
					this.plugin.settings.syncInterval = value;
					await this.plugin.saveSettings();
					this.plugin.setupAutoSync();
				}));

		// Manual Sync Button
		new Setting(containerEl)
			.setName('Manual Sync')
			.setDesc('Trigger a sync operation now')
			.addButton((button: any) => button
				.setButtonText('Sync Now')
				.setCta()
				.onClick(async () => {
					await this.plugin.performSync();
				}));

		// Last Sync Time
		if (this.plugin.settings.lastSyncTime) {
			const lastSync = new Date(this.plugin.settings.lastSyncTime).toLocaleString();
			containerEl.createEl('p', { 
				text: `Last sync: ${lastSync}`,
				cls: 'setting-item-description'
			});
		}
	}
}