/**
 * Social proof is switched off until real, approved data exists.
 * Only add customers who agreed in writing to be named, and quotes they approved verbatim.
 */
export interface Testimonial {
	quote: string;
	name: string;
	role: string;
	company: string;
}

export interface CustomerLogo {
	name: string;
	/** Path under /public, an SVG with a single color. */
	src: string;
}

export const socialProof: {
	enabled: boolean;
	/** For example "Über 500 Unternehmen arbeiten mit Swiver". Leave empty without a verified number. */
	statement: string;
	logos: CustomerLogo[];
	testimonials: Testimonial[];
} = {
	enabled: false,
	statement: "",
	logos: [],
	testimonials: [],
};
