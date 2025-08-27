const { workerData, parentPort } = require('worker_threads');
const fs = require('fs');
const csv = require('csv-parser');

const { filePath } = workerData;

//Main fn
function analyzeCsv(path) {
  return new Promise((resolve, reject) => {
    const analytics = {
      totalRows: 0,
      columnData: {}, // Will store stats for each column
      fileHeaders: [],
    };

    const stream = fs.createReadStream(path);

    stream
      .pipe(csv())
      .on('headers', (headers) => {
        analytics.fileHeaders = headers;
        //initialize the analytics object for each column
        headers.forEach(header => {
          analytics.columnData[header] = {
            type: 'unknown',
            min: Infinity,
            max: -Infinity,
            sum: 0,
            count: 0,
            // For categorical
            valueFrequencies: {},
          };
        });
      })
      .on('data', (row) => {
        analytics.totalRows++;
        for (const header of analytics.fileHeaders) {
          const value = row[header];
          const col = analytics.columnData[header];

          if (value === null || value === undefined || value === '') {
            continue;
          }

          //Data Type Detection & Analysis
          const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);

          if (isNumeric) {
            if (col.type !== 'categorical') {
              col.type = 'numeric';
              const numValue = parseFloat(value);

              if (numValue < col.min) col.min = numValue;
              if (numValue > col.max) col.max = numValue;
              col.sum += numValue;
              col.count++;
            }
          } else {
            col.type = 'categorical';
          }

          if (col.valueFrequencies[value]) {
            col.valueFrequencies[value]++;
          } else {
            col.valueFrequencies[value] = 1;
          }
        }
      })
      .on('end', () => {
        for (const header of analytics.fileHeaders) {
          const col = analytics.columnData[header];
          if(col.type === 'numeric' && Object.keys(col.valueFrequencies).length > 50) {
             delete col.valueFrequencies; 
          }
          
          if (col.type === 'numeric') {
            col.average = col.count > 0 ? col.sum / col.count : 0;
            if(col.min === Infinity) col.min = 0; 
            if(col.max === -Infinity) col.max = 0;
          }

          if (col.type === 'categorical' || (col.valueFrequencies && Object.keys(col.valueFrequencies).length <= 50)) {
            if (col.type === 'unknown') col.type = 'categorical'; 
            const sortedValues = Object.entries(col.valueFrequencies)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10); // Get top 10
            col.topValues = Object.fromEntries(sortedValues);
            delete col.valueFrequencies; 
          }
        }
        resolve(analytics);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

(async () => {
  try {
    const analyticsResult = await analyzeCsv(filePath);
    parentPort.postMessage({ success: true, analytics: analyticsResult });
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
})();