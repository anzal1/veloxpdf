# assets

`sRGB-v2-micro.icc` is the 456-byte sRGB IEC61966-2.1 (ICC v2) profile from
https://github.com/saucecontrol/Compact-ICC-Profiles (file `profiles/sRGB-v2-micro.icc`).
It is released under CC0 1.0 Universal (public domain dedication) by its author, Clinton Ingram.
See https://github.com/saucecontrol/Compact-ICC-Profiles/blob/master/license.

VeloxPDF embeds it as the PDF/A OutputIntent `DestOutputProfile` when rendering with
`pdfa: '3b'`. The same bytes are inlined as base64 in `src/pdf-writer.mjs`
(`SRGB_ICC_BASE64`), so no file read is needed at runtime and the browser bundle works as is.
