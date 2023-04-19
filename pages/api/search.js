import fs from 'fs/promises';
import path from 'path';

console.log('loading api ...');
const dataPath = '../../public/data/json_sentence_pairs';

async function* readFromJsonFiles(searchTerms) {
  const dataPath = path.join(process.cwd(), 'public/data/json_sentence_pairs');
  // console.log({ dirname: __dirname, joined: path.join(__dirname, dataPath) });
  // const jsonPath = path.join(__dirname, dataPath);
  const jsonPath = dataPath
  const jsonFiles = await fs.readdir(jsonPath);
  // console.log({ jsonFiles })

  for (const file of jsonFiles) {
    if (file.endsWith('.json')) {
      const content = await fs.readFile(path.join(jsonPath, file), 'utf8');
      // wrap in [] to make it an array, and split on newlines
      let objects = [];
      try {
        objects = JSON.parse(content);
      } catch (e) {
        console.log('error parsing json', e, file);
      }
      for (const obj of objects) {
        // console.log({ obj })
        if (Object.keys(obj).length > 0) {
          const { tokens, lemmas } = obj;

          if (!tokens || !lemmas) {
            console.log('missing tokens or lemmas', obj);
            continue;
          }
          for (const term of searchTerms) {
            if (tokens.includes(term) || lemmas.includes(term)) {
              // console.log('found', term, obj)
              yield obj;
              break;
            }
          }
        }
      }
    }
  }
}

console.log('api loaded');

// Define the API endpoint handler
// eslint-disable-next-line import/no-anonymous-default-export
export default async (req, res) => {
  // start timer
  const start = Date.now();
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query string parameter "query" is required.' });
  }

  const searchTerms = Array.isArray(query) ? query : [query];
  const results = [];

  for await (const item of readFromJsonFiles(searchTerms)) {
    results.push(item);
  }

  res.status(200).json({
    count: results.length,
    // format time as seconds to two decimal places
    time: (Date.now() - start) / 1000,
    results
  });
};
