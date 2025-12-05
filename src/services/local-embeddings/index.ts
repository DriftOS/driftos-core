import { pipeline } from '@xenova/transformers';

let model: any = null;
let loading: Promise<any> | null = null;

async function getModel() {
  if (model) return model;
  if (loading) return loading;

  loading = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  model = await loading;
  return model;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getModel();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}
