type MessageType =
  | "text"
  | "image"
  | "file"
  | "command"
  | "chat"
  | "none"
  | "code"
  | "binary";
  
  interface ViewRect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  
  interface VNCView {
    id: string;
    name: string;
    rect: ViewRect;
    createdAt: number;
  }
