export type Extraction = {
  title: string;
  memory?: string;
  items: Array<{
    label: string;
    value: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  groups: Array<{
    name: string;
    itemIndexes: number[];
  }>;
};
