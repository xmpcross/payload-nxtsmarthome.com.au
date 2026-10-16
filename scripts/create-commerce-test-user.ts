import fs from 'node:fs/promises'
import {randomBytes} from 'node:crypto'
const url=new URL(process.env.DATABASE_URL!);url.pathname='/nxtsmarthome_admin_test';process.env.DATABASE_URL=url.toString()
const {getPayload}=await import('payload');const config=(await import('../payload.config')).default;const p=await getPayload({config});const password=randomBytes(24).toString('base64url');const email='admin-verification@nxtsmarthome.invalid';await p.create({collection:'users',data:{name:'Temporary verification admin',email,password,role:'admin'},overrideAccess:true});await fs.writeFile('../migration/admin-expansion/test-credentials.json',JSON.stringify({email,password}),{mode:0o600});await p.destroy();process.exit(0)
