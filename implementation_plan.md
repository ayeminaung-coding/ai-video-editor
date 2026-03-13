# Add Subtitle Text Stroke Styling

Adding an outline (stroke) to subtitles provides greater control over aesthetics and readability. We will update the frontend configuration to capture stroke options, visually preview it, and apply it in the final FFmpeg render.

## User Review Required

Currently, the ASS subtitle format (`libass`) cannot natively render an outline (stroke) around text AND a background box in a single style. If `BorderStyle=3` is used (for background box), text outline is ignored. If `BorderStyle=1` is used, the text has outline/shadow but loses background padding boxes.

**Workaround (Dual-Layer ASS Hack):**
If the user enables **both** background opacity and stroke, I will generate a dual-layer ASS file:
1. **Layer 0 (Box Style):** `BorderStyle=3` to draw the opaque box. I will make the actual text fully transparent `{\1a&HFF&}` so it only renders the box.
2. **Layer 1 (Text Style):** `BorderStyle=1` to draw the stroked text, without any background. 

Since they use the identical timings and padding margins, Layer 1 text will perfectly sit on top of Layer 0's background box. Is this approach acceptable?

## Proposed Changes

### Frontend 

#### [MODIFY] [subtitle.ts](file:///d:/ai-video-editor/src/types/subtitle.ts)
- Add `strokeEnabled: boolean`, `strokeColor: string`, `strokeSize: number` to the [SubStyle](file:///d:/ai-video-editor/src/types/subtitle.ts#23-34) interface.

#### [MODIFY] [SubtitleOverlay.tsx](file:///d:/ai-video-editor/src/components/SubtitleOverlay.tsx)
- Apply `-webkit-text-stroke: {size}px {color}` to the active subtitle block when `style.strokeEnabled` is true.

#### [MODIFY] [SubtitlePreviewPage.tsx](file:///d:/ai-video-editor/src/SubtitlePreviewPage.tsx)
- Define initial state for `stroke` in `subStyle`.
- Add a new "Text Stroke" control section in the **Style** tab, featuring a toggle, color picker, and slider for stroke width.
- Append `stroke_enabled`, `stroke_color`, and `stroke_size` to the `FormData` on export.

### Backend

#### [MODIFY] [video.py](file:///d:/ai-video-editor/backend/routers/video.py)
- Update [start_export_video](file:///d:/ai-video-editor/backend/routers/video.py#294-389) endpoint to parse `stroke_enabled`, `stroke_color`, and `stroke_size` from `Form` data. Pass them to [run_export_task](file:///d:/ai-video-editor/backend/services/export_service.py#86-239).

#### [MODIFY] [export_service.py](file:///d:/ai-video-editor/backend/services/export_service.py)
- Update [run_export_task](file:///d:/ai-video-editor/backend/services/export_service.py#86-239) signature. 
- Convert the CSS `stroke_color` directly to the ASS layout colors and pass stroke parameters to [write_ass_from_srt](file:///d:/ai-video-editor/backend/services/subtitle_utils.py#80-127).

#### [MODIFY] [subtitle_utils.py](file:///d:/ai-video-editor/backend/services/subtitle_utils.py)
- Update [write_ass_from_srt](file:///d:/ai-video-editor/backend/services/subtitle_utils.py#80-127) signature.
- If both a stroke and a background box (`bg_opacity > 0`) are selected, define two `[V4+ Styles]`. One for the background box and one for the stroked text.
- Map the SRT events to `[Events]`. If dual-layer is necessary, duplicate each dialogue line for the background box (transparent text) and the top text layer (outlined).

## Verification Plan

### Manual Verification
1. I will load a dummy video and SRT file using the frontend.
2. Switch to the **Style** tab.
3. Toggle "Text Stroke", change the color to red, and adjust the size.
4. Verify the frontend preview text updates with a red stroke.
5. Set "Background Opacity" to 50% and click **Export Video + Subs**.
6. Wait for the export to finish, download the result, and verify that the FFmpeg burn-in effectively maintains both the stroke and the transparency box.
