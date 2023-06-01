import type { ContentStyle } from "@packages/types";

export const getCSSProperties = (style: ContentStyle) => {
  let fontSize, fontWeight, lineHeight, fontFamily, textDecoration;

  switch (style) {
    case "h1": {
      fontSize = "2.25rem";
      lineHeight = "2.5rem";
      break;
    }
    case "h2": {
      fontSize = "1.875rem";
      lineHeight = "2.25rem";
      break;
    }
    case "h3": {
      fontSize = "1.5rem";
      lineHeight = "2rem";
      break;
    }
    case "b": {
      fontWeight = "900";
      break;
    }
    case "i": {
      fontFamily = "italic";
      break;
    }
    case "u": {
      textDecoration = "underline";
      break;
    }
    default: {
      fontSize = "1rem";
      lineHeight = "1.2rem";
      textDecoration = "none";
      break;
    }
  }

  return {
    fontSize: fontSize,
    fontWeight: fontWeight,
    lineHeight: lineHeight,
    fontFamily: fontFamily,
    textDecoration: textDecoration,
  };
};
