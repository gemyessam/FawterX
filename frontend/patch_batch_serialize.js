const fs = require('fs');

const homeJsx = fs.readFileSync('src/pages/Home.jsx', 'utf8');
const serializeTokenRegex = /function serializeToken\(object\) \{[\s\S]*?\n\}/;
const correctSerializeToken = homeJsx.match(serializeTokenRegex)[0];

const escapeJsonStringRegex = /function escapeJsonString\(str\) \{[\s\S]*?\n\}/;
const correctEscapeJsonString = homeJsx.match(escapeJsonStringRegex)[0];

let batchWorkflowJsx = fs.readFileSync('src/components/BatchWorkflow.jsx', 'utf8');

const badSerializeTokenRegex = /\/\/ Simple serializer matching the local signer tool's expectation\nfunction serializeToken\(obj\) \{[\s\S]*?return str;\n\}/;

batchWorkflowJsx = batchWorkflowJsx.replace(badSerializeTokenRegex, correctEscapeJsonString + '\n\n' + correctSerializeToken);

fs.writeFileSync('src/components/BatchWorkflow.jsx', batchWorkflowJsx);
console.log("Updated BatchWorkflow.jsx with correct serializeToken");
