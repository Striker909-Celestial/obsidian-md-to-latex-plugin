import { Line, Tag } from "./line";
import {Notice} from "obsidian";

export class InlineModificationTexer {

	private static readonly REPLACE_SPECIAL_CHARS: InlineModificationTexer = new InlineModificationTexer(/([\\~^{}#$%&_])/, (match, p1) => {
		switch (p1) {
			case "\\": return "\\textbackslash{}";
			case "~": return "\\textasciitilde{}";
			case "^": return "\\textasciicircum{}";
			default: return "\\" + p1;
	}});

	private static checkURL(url: string): boolean {
		try { new URL(url); return true; }
		catch (e) { return false; }
	}

	public static readonly WIKILINK: InlineModificationTexer = new InlineModificationTexer(
		/(?:^|[^!])\[\[([^#|\]]+)(?:#([^|\]]+))?(?:\|([^\]]+))?]]/,
		(match, link, section, display) => {
			new Notice(match)
			if (InlineModificationTexer.checkURL(link)) {
				if (display) return "\\href{" + link + "}{" + display + "}";
				return "\\url{" + link + "}";
			}
			if (display) return display;
			if (section) return section;
			return link;
		}
	)

	public static readonly GRAPHIC: InlineModificationTexer = new InlineModificationTexer(
		/!\[\[([^.]+)(?:\.[^.]{2,6})?]]/,
		(match, p1) =>  "\\includegraphics{" + p1 + "}"
	)

	public static readonly URL: InlineModificationTexer = new InlineModificationTexer(
		/(?:^|[^{])(\[[^\]]*])?\(?((?:https?:\/\/)?[\da-z.-]+\.[a-z.]{2,6}(?:[\/\w .-]*)*\/?)\)?(?:$|[^}])/,
		(match, p1, p2) => {
			if (p1) {
				if (!InlineModificationTexer.checkURL(p2)) { return p1; }
				new Notice("\\href{" + p2 + "}{" + p1 + "}")
				return "\\href{" + p2 + "}{" + p1.substring(1, p1.length - 1) + "}";
			}
			if (!InlineModificationTexer.checkURL(p2)) { return p2; }
			return "\\url{" + p2 + "}";
		});

	public static readonly HORIZONTAL_LINE: InlineModificationTexer = new InlineModificationTexer(/^([-_*])\1\1+$/,
		() => "\\noindent\\rule{\\textwidth}{0.3pt}")

	public static readonly FOOTNOTE_TEXT: InlineModificationTexer = new InlineModificationTexer(/^\[\^(\d*)]: (.*)$/,
		(match, p1, p2) => "\\footnotetext[" + p1 + "]{" + p2 + "}")
	public static readonly FOOTNOTE_MARK: InlineModificationTexer = new InlineModificationTexer(/\[\^(\d*)](?:[^:]|$)/,
		(match, p1) => "\\footnotemark[" + p1 + "]{}")

	public static readonly BOLD: InlineModificationTexer = new InlineModificationTexer(/(\*\*|__)([^*]*)\1/,
		(match, p1, p2) => "\\textbf{" + InlineModificationTexer.REPLACE_SPECIAL_CHARS.apply(p2) + "}");
	public static readonly ITALIC: InlineModificationTexer = new InlineModificationTexer(/\*([^*]*)\*/,
		(match, p1) => "\\textit{" + InlineModificationTexer.REPLACE_SPECIAL_CHARS.apply(p1) + "}");
	public static readonly STRIKETHROUGH: InlineModificationTexer = new InlineModificationTexer(/~~([^*]*)~~/,
		(match, p1) => "\\sout{" + InlineModificationTexer.REPLACE_SPECIAL_CHARS.apply(p1) + "}");
	public static readonly HIGHLIGHT: InlineModificationTexer = new InlineModificationTexer(/==([^*]*)==/,
		(match, p1) => "\\hl{" + InlineModificationTexer.REPLACE_SPECIAL_CHARS.apply(p1) + "}");
	public static readonly TYPEWRITER: InlineModificationTexer = new InlineModificationTexer(/`([^*]*)`/,
		(match, p1) => "\\texttt{" + InlineModificationTexer.REPLACE_SPECIAL_CHARS.apply(p1) + "}");

	private constructor(
		private readonly regex: RegExp,
		private readonly replaceFunc: (...args: string[]) => string
	) {}

	public apply(text: string): string { return text.replace(this.regex, this.replaceFunc); }

	public static apply(text: string, texers: InlineModificationTexer[]): string;
	public static apply(line: Line, texers: InlineModificationTexer[]): Line;
	public static apply(lines: Line[], texers: InlineModificationTexer[]): Line[];
	public static apply(text: string): string;
	public static apply(line: Line): Line;
	public static apply(lines: Line[]): Line[];

	public static apply(text: string|Line|Line[], texers: InlineModificationTexer[] = [
		InlineModificationTexer.WIKILINK,
		InlineModificationTexer.GRAPHIC,
		InlineModificationTexer.URL,
		InlineModificationTexer.HORIZONTAL_LINE,
		InlineModificationTexer.FOOTNOTE_TEXT,
		InlineModificationTexer.FOOTNOTE_MARK,
		InlineModificationTexer.BOLD,
		InlineModificationTexer.ITALIC,
		InlineModificationTexer.STRIKETHROUGH,
		InlineModificationTexer.HIGHLIGHT,
		InlineModificationTexer.TYPEWRITER
	]): string|Line|Line[] {
		if (text instanceof Line) {
			text.conditionalModification(Tag.INLINE_MODIFICATION, (text) => InlineModificationTexer.apply(text, texers));
			return text;
		}
		if (text instanceof Array) {
			for (let i = 0; i < text.length; i++) {
				text[i] = InlineModificationTexer.apply(text[i]!, texers);
			}
			return text;
		}
		for (const emph of texers) {
			text = emph.apply(text);
		}
		return text;
	}
}

export class IndentedBlockTexer {

	public static readonly ITEMIZE = new IndentedBlockTexer(
		"itemize",
		/^(\s*)[-*] (.*)$/,
		(match, p1, p2) => "\\item " + p2, 
		(match) => (match != undefined) ? match[1]!.length : 0
	);
	public static readonly ENUMERATE = new IndentedBlockTexer(
		"enumerate",
		/^(\s*)\d[.)] (.*)$/,
		(match, p1, p2) => "\\item " + p2,
		(match) => (match != undefined) ? match[1]!.length : 0
	);
	public static readonly BLOCKQUOTE = new IndentedBlockTexer(
		"displayquote",
		/^((?:>\s)+)(.*)$/,
		(match, p1, p2) => p2,
		(match) => (match != undefined) ? match[1]!.length / 2 : 0
	);

	private constructor(
		private readonly keyword:string,
		private readonly regex: RegExp,
		private readonly replaceFunc: (...args: string[]) => string,
		private readonly indentFunc: (match: RegExpExecArray) => number
	) {}

	public apply(line: Line): Line;

	public apply(line: Line): Line {
		const match = this.regex.exec(line.getText());
		if (!match) { return line; }
		const indent = this.indentFunc(match);
		const tag = Tag.indentBlock(indent, this.keyword)
		line.conditionalModification(tag, (text) => text.replace(this.regex, this.replaceFunc));
		return line;
	}

	public static apply(line: Line, texers: IndentedBlockTexer[]): Line;
	public static apply(lines: Line[], texers: IndentedBlockTexer[]): Line[];
	public static apply(line: Line): Line;
	public static apply(lines: Line[]): Line[];

	public static apply(line: Line|Line[], texers: IndentedBlockTexer[] = [
		IndentedBlockTexer.ITEMIZE,
		IndentedBlockTexer.ENUMERATE,
		IndentedBlockTexer.BLOCKQUOTE
	]): Line|Line[] {
		if (line instanceof Line) {
			for (const lineBlock of texers) {
				line = lineBlock.apply(line);
			}
			return line;
		}
		if (line instanceof Array) {
			const output: Line[] = [];
			let open = 0;                 // number of block environments currently open
			let currentKeyword = "";
			// Raw indent widths for each currently-open level. Its length is the
			// normalized nesting depth, so arbitrary raw widths (tabs, 2- or
			// 4-space indents) collapse to consecutive 0-based levels.
			let indentStack: number[] = [];
			// Close environments until only `need` remain open.
			const closeTo = (need: number) => {
				for (; open > need; open--) {
					output.push(new Line("\t".repeat(open - 1) + "\\end{" + currentKeyword + "}", [Tag.INDENT_BLOCK]));
				}
				if (need == 0) { currentKeyword = ""; }
			}
			// Open environments until `need` are open.
			const openTo = (need: number) => {
				for (; open < need; open++) {
					output.push(new Line("\t".repeat(open) + "\\begin{" + currentKeyword + "}", [Tag.INDENT_BLOCK]));
				}
			}
			const go = (need: number) => {
				if (open < need) { openTo(need); }
				else if (open > need) { closeTo(need); }
			}
			// Reset all block state (used when a list ends or the block type changes).
			const reset = () => {
				closeTo(0);
				indentStack = [];
			}
			// Normalize a raw indent width to a 0-based nesting level via the stack.
			const levelFor = (raw: number): number => {
				while (indentStack.length > 0 && raw < indentStack[indentStack.length - 1]!) {
					indentStack.pop();
				}
				if (indentStack.length == 0 || raw > indentStack[indentStack.length - 1]!) {
					indentStack.push(raw);
				}
				return indentStack.length - 1;
			}
			for (let i = 0; i < line.length; i++) {
				const currentLine = IndentedBlockTexer.apply(line[i]!, texers);
				if (!currentLine.tags.contains(Tag.INDENT_BLOCK)) {
					reset();
					output.push(currentLine);
					continue;
				}

				const tag = currentLine.tags.get(Tag.INDENT_BLOCK)!;
				const indent = tag.data.get("indent") as number;
				const keyword = tag.data.get("keyword") as string;

				if (keyword != currentKeyword) {
					reset();
					currentKeyword = keyword;
				}
				// Map the raw indent width to a 0-based level, then ensure that
				// many + 1 environments are open and indent the content to match.
				const level = levelFor(indent);
				go(level + 1);
				currentLine.setText("\t".repeat(level + 1) + currentLine.getText());
				output.push(currentLine);
			}
			reset();
			return output;
		}
		return line;
	}
}

export class TableTexer {

	private static row_regex = /^(?:\|([^|]+))+\|$/;
	private static row_replace = (match: string) => {
		let out = "";
		const groups = match.split("|")
		for (let i = 1; i < groups.length - 1; i++) {
			if (i > 1) out += " & ";
			 out += groups[i];
		}
		return "\t" + out + "\\\\";
	};
	private static alignment_regex = /^(?:\|\s*(:?-+:?)\s*)+\|$/;
	private static center_align_regex = /\s*:-+:\s*/;
	private static right_align_regex = /\s*-+:\s*/;

	private constructor() {}

	public static apply(lines: Line[]): Line[] {
		let out: Line[] = [];
		let table: boolean = false;
		let table_begin = -1;
		let alignments: string[] = []
		let alignmentReplace = (match: string) => {
			if (alignments.length > 0) { return "\\hline"; }
			const groups = match.split("|")
			for (let i = 1; i < groups.length - 1; i++) {
				if (TableTexer.center_align_regex.test(groups[i]!)) { alignments.push("c"); }
				else if (TableTexer.right_align_regex.test(groups[i]!)) { alignments.push("r"); }
				else { alignments.push("l"); }
			}
			return "\\hline";
		}

		for (const line of lines) {
			if (!TableTexer.row_regex.test(line.getText())) {
				if (table) {
					out.push(new Line("\\hline", [Tag.TABLE]));
					out.push(new Line("\\end{tabular}", [Tag.TABLE]));
					alignments = [];
					table = false;
				}
				out.push(line);
				continue;
			}
			if (!table) {
				table = true;
				table_begin = out.length;
				out.push(new Line(""));
				out.push(new Line("\\hline", [Tag.TABLE]));
			}
			if (TableTexer.alignment_regex.test(line.getText())) {
				line.conditionalModification(Tag.TABLE, (text) => text.replace(TableTexer.alignment_regex, alignmentReplace))
				out.push(line);
				const alignmentsBlock = alignments.join("|")
				out[table_begin]!.conditionalModification(Tag.TABLE, (text) => "\\begin{tabular}{ |" + alignmentsBlock + "| }");
				continue;
			}
			line.conditionalModification(Tag.TABLE, (text) => text.replace(TableTexer.row_regex, TableTexer.row_replace));
			out.push(line);
		}

		return out;
	}

}

export class BlockTexer {

	public static readonly MATH: BlockTexer = new BlockTexer(
		/^\$\$$/, () => "$$",
		/^\$\$$/, () => "$$"
	)
	public static readonly CODE: BlockTexer = new BlockTexer(
		/^```(\S+)?$/,
		(match: string, p1: string) => {
			if (p1) { return "\\begin{lstlisting}[language=" + p1 + "]"; }
			return "\\begin{lstlisting}";
		},
		/^```$/,
		() => "\\end{lstlisting}"
	)

	private constructor(
		public readonly startRegex: RegExp,
		public readonly startReplace: (...args: string[]) => string,
		public readonly endRegex: RegExp,
		public readonly endReplace: (...args: string[]) => string
	) {}

	public static apply(lines: Line[], texers: BlockTexer[] = [BlockTexer.MATH, BlockTexer.CODE]): Line[] {
		let currentTexer: number = -1;
		for (let i = 0; i < lines.length; i++) {
			if (currentTexer == -1) {
				for (let j = 0; j < texers.length; j++) {
					if (texers[j]!.startRegex.test(lines[i]!.getText())) {
						const texer = texers[j]!;
						lines[i]!.conditionalModification(Tag.BLOCK, (text) => text.replace(texer.startRegex, texer.startReplace))
						currentTexer = j;
						break;
					}
				}
				continue;
			}
			if (!texers[currentTexer]!.endRegex.test(lines[i]!.getText())) { lines[i]!.addTag(Tag.BLOCK); continue; }
			const texer = texers[currentTexer]!;
			lines[i]!.conditionalModification(Tag.BLOCK, (text) => text.replace(texer.endRegex, texer.endReplace))
			currentTexer = -1;

		}
		return lines;
	}
}

export function tag_headers(lines: Line[], header_regex: RegExp = /(#{1,6}) (.*)/): Line[] {
	for (let i = 0; i < lines.length; i++) {
		const match = header_regex.exec(lines[i]!.getText())
		if (match) {
			const tag = Tag.header(match[1]!.length);
			lines[i]!.conditionalModification(tag, () => match[2]!)
		}
	}
	return lines;
}

export function body_texer(body: Line[], texer_funcs: ((lines: Line[]) => Line[])[] = [
	tag_headers,
	BlockTexer.apply,
	TableTexer.apply,
	IndentedBlockTexer.apply,
	InlineModificationTexer.apply
]): Line[] {
	for (const texer of texer_funcs) {
		body = texer(body);
	}
	return body;
}
