import { deriveKatm2yInputs } from './modules/integrations/katm/service/shared';
import testItem from './test.json';
console.log(testItem);

let date = new Date();
date.setFullYear(date.getFullYear() - 2);
const result = deriveKatm2yInputs(testItem, date);

console.log(result);
