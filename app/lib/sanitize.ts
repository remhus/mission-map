import sanitizeHtml from 'sanitize-html';

// Tag/attribute allowlist matching exactly what Tiptap StarterKit produces
const ALLOWED_TAGS = [
  'p', 'br',
  'h1', 'h2', 'h3',
  'strong', 'em', 'u', 's',
  'ul', 'ol', 'li',
  'blockquote', 'hr',
  'img',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  img: ['src', 'alt'],
  '*': ['style'],
};

const ALLOWED_STYLES: sanitizeHtml.IOptions['allowedStyles'] = {
  '*': {
    'text-align': [/^(left|center|right|justify)$/],
  },
};

export function sanitizeRichHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    disallowedTagsMode: 'discard',
  });
}
