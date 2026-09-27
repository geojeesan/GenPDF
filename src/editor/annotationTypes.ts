export type AnnotationType = 
  | 'text' 
  | 'pen' 
  | 'highlight' 
  | 'rectangle' 
  | 'circle' 
  | 'line' 
  | 'arrow' 
  | 'signature' 
  | 'stamp'
  | 'redaction';

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  pageIndex: number;
  // Normalized coordinates (0 to 1 relative to page width and height)
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number; // in pt
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  borderColor?: string;
  isBold: boolean;
  isItalic: boolean;
  textAlign: 'left' | 'center' | 'right';
  // If editing existing text embedded in the PDF:
  isExistingTextEdit?: boolean;
  originalText?: string;
  originalBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface PenAnnotation extends BaseAnnotation {
  type: 'pen';
  points: Point[]; // normalized points relative to page
  color: string;
  strokeWidth: number; // in pt
  opacity: number;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight';
  points: Point[];
  color: string;
  strokeWidth: number;
  opacity: number;
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rectangle' | 'circle' | 'line' | 'arrow';
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  opacity: number;
  hasArrowHead?: boolean;
  startPoint?: Point;
  endPoint?: Point;
}

export interface SignatureAnnotation extends BaseAnnotation {
  type: 'signature';
  imageDataUrl: string; // transparent PNG
}

export interface StampAnnotation extends BaseAnnotation {
  type: 'stamp';
  label: string;
  color: string;
  dateStr?: string;
}

export interface RedactionAnnotation extends BaseAnnotation {
  type: 'redaction';
  fillColor: string; // e.g. '#000000' or '#ffffff'
}

export type Annotation = 
  | TextAnnotation 
  | PenAnnotation 
  | HighlightAnnotation 
  | ShapeAnnotation 
  | SignatureAnnotation 
  | StampAnnotation 
  | RedactionAnnotation;

export type ToolType = 
  | 'select' 
  | 'hand' 
  | 'edit-text'
  | 'text' 
  | 'pen' 
  | 'highlight' 
  | 'rectangle' 
  | 'circle' 
  | 'line' 
  | 'arrow' 
  | 'signature' 
  | 'stamp' 
  | 'redaction'
  | 'eraser';
