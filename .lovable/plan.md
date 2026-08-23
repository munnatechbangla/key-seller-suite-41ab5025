# Product Description Formatting Fix

This plan addresses the issue where product descriptions lose their formatting (line breaks, paragraphs, lists) on the customer-facing product page. We will upgrade the admin editor to a rich text editor and improve the storefront rendering to handle both HTML and plain text correctly.

## Proposed Changes

### 1. Admin UI Upgrade
- Modify `src/routes/admin.products.$id.tsx` to replace the standard `textarea` for the product description with the `RichTextEditor` component.
- This ensures that when an admin enters paragraphs, lists, and headings, they are saved as proper HTML tags rather than plain text.

### 2. Storefront Rendering Improvements
- Update `src/routes/products.$slug.tsx` to handle both HTML and plain text descriptions.
- Remove restrictive CSS classes (`prose-p:my-2`, etc.) that were compressing the layout and losing the intended spacing.
- Add a utility to automatically wrap plain text lines in `<p>` tags if no HTML is detected, ensuring legacy descriptions still render with line breaks.

### 3. CMS Content Block Fixes
- Update `src/components/cms/ProductContentBlocks.tsx` to ensure `rich_text` blocks use standard `prose` spacing.
- Improve the `markdown` block rendering to at least support basic formatting or consistent spacing.

### 4. Layout Renderer Alignment
- Update `src/components/cms/ProductLayoutRenderer.tsx` to match the improved rendering logic for descriptions.

## Technical Details
- **Admin**: Use `import { RichTextEditor } from "@/components/admin/RichTextEditor"` in `src/routes/admin.products.$id.tsx`.
- **Renderer**: Use a helper function `const formattedDescription = (desc || "").includes('<p>') ? desc : (desc || "").split('\n').filter(Boolean).map(p => \`<p>\${p}</p>\`).join('')`.
- **Styling**: Ensure `prose` and `prose-invert` are used without excessive overrides to maintain natural document flow and spacing for both English and Bangla text.
