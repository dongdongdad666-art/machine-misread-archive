import handler from '../../api/submit.ts';
import {adapt} from '../../server/edgeone.mjs';
const invoke=adapt(handler);
export default function onRequest(context){return invoke(context);}
