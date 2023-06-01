export type Folder = {
	id: string;
	name?: string;
	page_ids?: string[];
}

export type Page = {
	id: string;
	name?: string;
	content?: string[];
};

export type Content = {
	id: string;
	value?: string;
  style?: ContentStyle;
};

export type ContentStyle = keyof typeof styleSchema;

export const styleSchema = {
	// default
	d: "none",
	// headings
	h1: "heading 1",
	h2: "heading 2",
	h3: "heading 3",
	// text
	b: "bold",
	i: "italic",
	u: "underline",
} as const;
