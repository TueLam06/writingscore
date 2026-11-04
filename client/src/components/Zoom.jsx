import { createContext, useContext, useState } from "react";

// Bấm vào ảnh để xem phóng to; bấm lần nữa (hoặc Esc) để đóng
const ZoomContext = createContext(() => {});

export function ZoomProvider({ children }) {
  const [src, setSrc] = useState(null);
  return (
    <ZoomContext.Provider value={setSrc}>
      {children}
      {src && (
        <button
          type="button"
          className="zoom"
          aria-label="Đóng ảnh phóng to"
          onClick={() => setSrc(null)}
          onKeyDown={(e) => e.key === "Escape" && setSrc(null)}
          autoFocus
        >
          <img src={src} alt="" />
        </button>
      )}
    </ZoomContext.Provider>
  );
}

export function ZoomImg({ src, alt = "", ...rest }) {
  const zoom = useContext(ZoomContext);
  return <img src={src} alt={alt} onClick={() => zoom(src)} {...rest} />;
}
