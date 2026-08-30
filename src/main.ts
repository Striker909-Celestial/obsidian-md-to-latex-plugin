import {FileSystemAdapter, getFrontMatterInfo, Notice, Plugin, TAbstractFile, TFile, TFolder} from 'obsidian';
import {DEFAULT_SETTINGS, MDtoTEXSettings, MDtoTEXSettingTab} from "./settings";
import {Document} from "./document_texer"
import {execSync} from "node:child_process";

export default class MDtoTEXPlugin extends Plugin {
	settings: MDtoTEXSettings;

	async separateContent(file: TFile) {
		const fileContents = await this.app.vault.read(file);

		const { contentStart, exists } = getFrontMatterInfo(fileContents);

		const bodyOnly = fileContents.slice(contentStart);

		const fileCache = this.app.metadataCache.getFileCache(file);
		const frontMatter = fileCache?.frontmatter || {};
		const properties = new Map<string, any>();

		for (const [key, value] of Object.entries(frontMatter)) { properties.set(key, value); }

		return {
			properties: properties,
			body: bodyOnly
		};
	}

	async buildDocument(file: TFile) {
		const { properties, body } = await this.separateContent(file);
		const title: string = file.basename;
		try {
			return new Document(title, body, properties, this.settings);
		} catch (e) {
			new Notice(`Error while building document: ${e}`)
			throw Error(`Error while building document: ${e}`)
		}
	}

	getCurrentFile() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file");
			throw new Error("No active file");
		}
		return activeFile;
	}

	private getOutputFolderPath(title: string): string { return this.settings.output_folder.replace("{FILENAME}", title); }

	async writeDocumentToFile(document: Document) {
		const outputFolderPath = this.getOutputFolderPath(document.title);
		try {
			await this.app.vault.createFolder(outputFolderPath);
		} catch (e) {
			const tex = this.app.vault.getAbstractFileByPath(outputFolderPath + "/" + document.title + ".tex");
			if (tex instanceof TAbstractFile) {
				await this.app.vault.delete(tex)
			}
		}
		try {
			return this.app.vault.create(outputFolderPath + "/" + document.title + ".tex", document.latex_text);
		} catch (e) {
			new Notice("Failed to write file: " + outputFolderPath + "/" + document.title + ".tex\nError message: " + e);
			throw Error("Failed to write file: " + outputFolderPath + "/" + document.title + ".tex\nError message: " + e);
		}
	}

	private getPDFConversionCommand(file: TFile): string {
		var root = "";
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			root = adapter.getBasePath();
		}
		const filePath = "\"" + root + "/" + file.path + "\"";
		const outputFolderPath = "\"" + root + "/" + this.getOutputFolderPath(file.basename) + "\"";
		return this.settings.pdf_conversion_command.replace("{FILE_PATH}", filePath).replace("{OUTPUT_FOLDER_PATH}", outputFolderPath);
	}

	private convertFileToPDF(file: TFile) {
		const command = this.getPDFConversionCommand(file);
		try {
			execSync(command);
		} catch (e) {
			new Notice(`Failed to convert file to PDF: ${e}`);
			throw Error(`Failed to convert file to PDF: ${e}`)
		}
	}

	async onload() {
		this.registerExtensions(["tex"], "markdown");
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('pdf-file', 'Convert to LaTeX', async (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice(`Convert to LaTeX: Fetching current file`)
			const currentFile = this.getCurrentFile();
			var texFile = null;
			if (currentFile.extension == "md") {
				new Notice(`Convert to LaTeX: Converting current file into a .tex file`)
				const document = await this.buildDocument(currentFile);
				new Notice(`Convert to LaTeX: ${document ? "Success" : "Encountered an Error"}`)
				new Notice(`Convert to LaTeX: Writing file to ${this.getOutputFolderPath(document.title)}/${document.title}.tex`)
				texFile = await this.writeDocumentToFile(document);
				new Notice(`Convert to LaTeX: ${texFile ? "Success" : "Encountered an Error"}`)
			} else if (currentFile.extension == "tex") {
				texFile = currentFile;
			} else {
				new Notice(`Convert to LaTeX: Current file is not a .md or a .tex file`)
				return;
			}
			if (!this.settings.convert_to_pdf) { return; }
			new Notice(`Convert to LaTeX: Converting .tex file to PDF`)
			this.convertFileToPDF(texFile)
			new Notice(`Convert to LaTeX: Conversion to PDF completed`)
		});

		// This adds a simple command that can be triggered anywhere
		/*this.addCommand({
			id: 'open-modal-simple',
			name: 'Open modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection('Sample editor command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			}
		});*/

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MDtoTEXSettingTab(this.app, this));

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MDtoTEXSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/*class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}*/
