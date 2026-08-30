import {HashSet} from "./hash_set";

export class Tag {

	public static readonly HEADER: Tag = new Tag("HEADER");
	public static readonly BODY: Tag = new Tag("BODY");
	public static readonly BLOCK: Tag = new Tag("BLOCK");
	public static readonly LINE_BLOCK: Tag = new Tag("LINE_BLOCK");
	public static readonly INLINE_MODIFICATION: Tag = new Tag("INLINE_MODIFICATION");

	public static header(level: number): Tag { return new Tag("HEADER", new HashSet<Tag>(Tag.hash_code), Tag.HEADER, new Map<string, any>([["level", level]])); }
	public static body(): Tag { return this.BODY; }
	public static block(): Tag { return this.BLOCK; }
	public static lineBlock(indent: number, keyword: string): Tag { return new Tag("LINE_BLOCK", new HashSet<Tag>(Tag.hash_code), Tag.LINE_BLOCK,
		new Map<string, any>([["indent", indent], ["keyword", keyword]])); }
	public static inlineModification(): Tag { return this.INLINE_MODIFICATION; }

	private constructor(
		public readonly name: string,
		public readonly excludes: HashSet<Tag> = new HashSet<Tag>(Tag.hash_code),
		inheritFrom?: Tag,
		public readonly data: Map<string, any> = new Map<string, any>()
	) {
		if (inheritFrom) {
			this.excludes.addAll(inheritFrom.excludes.values());
			for (const [key, value] of inheritFrom.data.entries()) {
				if (this.data.has(key)) { continue; }
				this.data.set(key, value);
			}
		}
	}

	public static hash_code(tag: Tag): string { return tag.name; }
	public static equals(tag1: Tag, tag2: Tag): boolean { return tag1.name == tag2.name; }
	public equals(tag: Tag): boolean { return Tag.equals(this, tag); }
}

Tag.HEADER.excludes.add(Tag.BODY);
Tag.BODY.excludes.add(Tag.HEADER);
Tag.LINE_BLOCK.excludes.addAll(Tag.BODY.excludes.values());
Tag.BLOCK.excludes.addAll([Tag.LINE_BLOCK, Tag.INLINE_MODIFICATION]);
Tag.BLOCK.excludes.addAll(Tag.BODY.excludes.values());

export class Line {
	public readonly tags: HashSet<Tag>;

	constructor(private text: string, tags?: Iterable<Tag>) {
		this.tags = new HashSet<Tag>(Tag.hash_code)
		if (tags) { this.tags.addAll(tags); }
	}

	public getText(): string { return this.text; }

	public checkTagCompatibility(tag: Tag): boolean {
		if (this.tags.contains(tag) || HashSet.intersection(this.tags, tag.excludes).size() > 0) { return false; }
		for (const _tag of this.tags.values()) {
			if (_tag.excludes.contains(tag)) { return false; }
		}
		return true;
	}

	public setText(text: string): void { this.text = text; }

	// Returns false if the given tag is incompatible with the line''s current tags or if the modifier does not modify the text.
	// Otherwise, modifies the text, adds the tag to this line, and returns true.
	public conditionalModification(tag: Tag, modifier: (text: string) => string): boolean {
		if (!this.checkTagCompatibility(tag)) { return false; }
		const modifiedText = modifier(this.text);
		if (modifiedText == this.text) { return false; }
		this.text = modifiedText;
		this.tags.add(tag);
		return true;
	}

	public addTag(tag: Tag): boolean {
		if (!this.checkTagCompatibility(tag)) { return false; }
		this.tags.add(tag);
		return true;
	}
}
