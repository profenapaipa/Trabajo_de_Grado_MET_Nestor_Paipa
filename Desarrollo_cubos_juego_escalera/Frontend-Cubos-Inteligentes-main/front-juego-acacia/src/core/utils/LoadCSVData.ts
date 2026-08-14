//Carga la info de un archivo
//Usado en la carga de los sources y targets
export async function loadDataFromFile(path: string): Promise<number[]> {
  const res = await fetch(path);
  const text = await res.text();

  return text
    .trim()
    .split('\n')
    .map(line => parseInt(line.trim(), 10))
    .filter(num => !isNaN(num));
}

//Lee el csv de los estados y retorna una matriz
import states from '@/assets/GraphData/EstadosGrafo.csv?url';

export async function loadGraphStates(path = states): Promise<number[][]> {
  
  const res = await fetch(path);
  const text = await res.text();
  const lines = text.trim().split('\n');
  const data: number[][] = [];
  for (const line of lines) {
    const values = line.split(',').map(value => parseFloat(value.trim()));
    if (values.every(value => !isNaN(value))) {
      data.push(values);
    }
  }
  return data;
}