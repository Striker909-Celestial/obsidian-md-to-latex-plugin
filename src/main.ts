import {App, Editor, MarkdownView, Modal, Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, MDtoTEXSettings, MDtoTEXSettingTab} from "./settings";
import {currentMDtoTEX, MDtoTEX} from "./converter";

export default class MDtoTEXPlugin extends Plugin {
	settings: MDtoTEXSettings;

	async onload() {
		this.registerExtensions(["tex"], "markdown");
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('pdf-file', 'Convert to LaTeX', async (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice(`Convert to LaTeX: Converting current file into a .tex file`)
			new Notice(`Convert to LaTeX: ${await currentMDtoTEX(this, this.settings) ? "Success" : "Encountered an Error"}`)
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
