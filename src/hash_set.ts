export class HashSet<T> {
	private map = new Map<string, T>();

	constructor(private hash_func: (t: T) => string, items?: Iterable<T>) {
		if (items) { this.addAll(items); }
	}

	public add(item: T): boolean {
		const key = this.hash_func(item);
		if (this.map.has(key)) { return false; }
		this.map.set(key, item);
		return true;
	}

	public addAll(items: Iterable<T>): void {
		for (const item of items) { this.add(item); }
	}

	public remove(item: T): boolean {
		const key = this.hash_func(item);
		if (!this.map.has(key)) { return false; }
		this.map.delete(key);
		return true;
	}

	public removeAll(items: Iterable<T>): void {
		for (const item of items) { this.remove(item); }
	}

	public contains(item: T): boolean {
		const key = this.hash_func(item);
		return this.map.has(key);
	}

	public containsAll(items: Iterable<T>): boolean {
		for (const item of items) {
			if (!this.contains(item)) { return false; }
		}
		return true;
	}

	public containsAny(items: Iterable<T>): boolean {
		for (const item of items) {
			if (this.contains(item)) { return true; }
		}
		return false;
	}

	public get(item: T): T | undefined {
		const key = this.hash_func(item);
		return this.map.get(key);
	}

	public size(): number { return this.map.size; }

	public clear(): void { this.map.clear(); }

	*values(): IterableIterator<T> {
		yield* this.map.values();
	}

	public static union<T>(set1: HashSet<T>, set2: HashSet<T>): HashSet<T> {
		const union = new HashSet<T>(set1.hash_func);
		union.addAll(set1.values());
		union.addAll(set2.values());
		return union;
	}

	public static intersection<T>(set1: HashSet<T>, set2: HashSet<T>): HashSet<T> {
		const intersection = new HashSet<T>(set1.hash_func);
		for (const item of set1.values()) {
			if (set2.contains(item)) { intersection.add(item); }
		}
		return intersection;
	}

	public static difference<T>(set1: HashSet<T>, set2: HashSet<T>) {
		const difference = new HashSet<T>(set1.hash_func);
		for (const item of set1.values()) {
			if (!set2.contains(item)) { difference.add(item); }
		}
		return difference;
	}

	public static symmetricDifference<T>(set1: HashSet<T>, set2: HashSet<T>) {
		const symmetricDifference = new HashSet<T>(set1.hash_func);
		for (const item of set1.values()) {
			if (!set2.contains(item)) { symmetricDifference.add(item); }
		}
		for (const item of set2.values()) {
			if (!set1.contains(item)) { symmetricDifference.add(item); }
		}
		return symmetricDifference;
	}
}
