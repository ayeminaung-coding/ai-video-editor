export interface SubLine {
    id: number;
    start: number;  // seconds
    end: number;    // seconds
    text: string;
}

export interface SubStyle {
    fontSize: number;
    color: string;
    bgOpacity: number;
    position: 'bottom' | 'top';
}
