import { ZoomImg } from "./Zoom.jsx";

// Đề bài kèm ảnh biểu đồ (nếu có)
export default function PromptBlock({ a }) {
  return (
    <>
      <div className="prompt">{a.prompt}</div>
      {a.promptImage && (
        <div className="thumbs" style={{ marginTop: 10 }}>
          <ZoomImg src={`/uploads/${a.promptImage}`} alt="Biểu đồ của đề" />
        </div>
      )}
    </>
  );
}
