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

	public static readonly FORMATTED_URL: InlineModificationTexer = new InlineModificationTexer(
		/\[([^\]]*)]\(((?:https?:\/\/)?[\da-z.-]+\.[a-z.]{2,6}(?:[\/\w .-]*)*\/?)\)/,
		(match, p1, p2) => {
		if (!InlineModificationTexer.checkURL(p2)) { return p1; }
			return "\\href{" + p2 + "}{" + p1 + "}";
		});
	public static readonly RAW_URL: InlineModificationTexer = new InlineModificationTexer(
		/[^{]((?:https?:\/\/)?[\da-z.-]+\.[a-z.]{2,6}(?:[\/\w .-]*)*\/?)[^}]/,
		(match, p1) => {
		if (!InlineModificationTexer.checkURL(p1)) { return p1; }
			return "\\url{" + p1 + "}";
		});

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
		InlineModificationTexer.FORMATTED_URL,
		InlineModificationTexer.RAW_URL,
		InlineModificationTexer.BOLD,
		InlineModificationTexer.ITALIC,
		InlineModificationTexer.STRIKETHROUGH,
		InlineModificationTexer.HIGHLIGHT,
		InlineModificationTexer.TYPEWRITER]): string|Line|Line[] {
		if (text instanceof Line) {
			text.conditionalModification(Tag.INLINE_MODIFICATION, (text) => InlineModificationTexer.apply(text, texers));
			return text;
		}
		if (text instanceof Array) {
			for (var i = 0; i < text.length; i++) {
				text[i] = InlineModificationTexer.apply(text.at(i)!, texers);
			}
			return text;
		}
		for (const emph of texers) {
			text = emph.apply(text);
		}
		return text;
	}
}

export class LineBlockTexer {

	public static readonly ITEMIZE = new LineBlockTexer(
		"itemize",
		/^(\s*)[-*] (.*)$/,
		(match, p1, p2) => "\\item " + p2, 
		(match) => (match != undefined) ? match[1]!.length : 0
	);
	public static readonly ENUMERATE = new LineBlockTexer(
		"enumerate",
		/^(\s*)\d[.)] (.*)$/,
		(match, p1, p2) => "\\item " + p2,
		(match) => (match != undefined) ? match[1]!.length : 0
	);
	public static readonly BLOCKQUOTE = new LineBlockTexer(
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
		const tag = Tag.lineBlock(indent, this.keyword)
		// Store the raw indent width in the tag; it is normalized to a nesting
		// level (and re-indented) in the array pass of the static apply().
		line.conditionalModification(tag, (text) => text.replace(this.regex, this.replaceFunc));
		return line;
	}

	public static apply(line: Line, texers: LineBlockTexer[]): Line;
	public static apply(lines: Line[], texers: LineBlockTexer[]): Line[];
	public static apply(line: Line): Line;
	public static apply(lines: Line[]): Line[];

	public static apply(line: Line|Line[], texers: LineBlockTexer[] = [
		LineBlockTexer.ITEMIZE,
		LineBlockTexer.ENUMERATE,
		LineBlockTexer.BLOCKQUOTE
	]): Line|Line[] {
		if (line instanceof Line) {
			for (const lineBlock of texers) {
				line = lineBlock.apply(line);
			}
			return line;
		}
		if (line instanceof Array) {
			const output: Line[] = [];
			var open = 0;                 // number of block environments currently open
			var currentKeyword = "";
			// Raw indent widths for each currently-open level. Its length is the
			// normalized nesting depth, so arbitrary raw widths (tabs, 2- or
			// 4-space indents) collapse to consecutive 0-based levels.
			var indentStack: number[] = [];
			// Close environments until only `need` remain open.
			const close = (need: number) => {
				for (; open > need; open--) {
					output.push(new Line("\t".repeat(open - 1) + "\\end{" + currentKeyword + "}", [Tag.LINE_BLOCK]));
				}
				if (need == 0) { currentKeyword = ""; }
			}
			// Open environments until `need` are open.
			const openTo = (need: number) => {
				for (; open < need; open++) {
					output.push(new Line("\t".repeat(open) + "\\begin{" + currentKeyword + "}", [Tag.LINE_BLOCK]));
				}
			}
			const go = (need: number) => {
				if (open < need) { openTo(need); }
				else if (open > need) { close(need); }
			}
			// Reset all block state (used when a list ends or the block type changes).
			const reset = () => {
				close(0);
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
			for (var i = 0; i < line.length; i++) {
				const currentLine = LineBlockTexer.apply(line[i]!, texers);
				if (!currentLine.tags.contains(Tag.LINE_BLOCK)) {
					reset();
					output.push(currentLine);
					continue;
				}

				const tag = currentLine.tags.get(Tag.LINE_BLOCK)!;
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
		var currentTexer: number = -1;
		for (var i = 0; i < lines.length; i++) {
			if (currentTexer == -1) {
				for (var j = 0; j < texers.length; j++) {
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
	for (var i = 0; i < lines.length; i++) {
		const match = header_regex.exec(lines[i]!.getText())
		if (match) {
			const tag = Tag.header(match[1]!.length);
			lines[i]!.conditionalModification(tag, () => match[2]!)
		}
	}
	return lines;
}

export function body_texer(body: Line[], texer_funcs: ((lines: Line[]) => Line[])[] = [
	BlockTexer.apply,
	tag_headers,
	LineBlockTexer.apply,
	InlineModificationTexer.apply
]): Line[] {
	for (const texer of texer_funcs) {
		body = texer(body);
	}
	return body;
}
