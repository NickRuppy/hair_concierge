/* eslint-disable @typescript-eslint/no-require-imports -- Historical portable CommonJS diagnostic harness. */
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const path = require('node:path');
const repoRoot = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(repoRoot, 'package.json'));
const ts = req('typescript');
const mode = process.argv[2] || 'missing';
const state = {claims: [], calls: [], signals: []};
const user = mode === 'unauthenticated' ? null : {id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.test'};
const reservation = {id:'00000000-0000-4000-8000-000000000002',provider:null,provider_reference:null,status:'open',return_destination:'/chat'};
const db = {auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{stripe_customer_id:mode==='missing'?'cus_missing_fixture':'cus_valid_fixture'},error:null})})})})};
class Conflict extends Error {}
const overrides = {
 'next/server': {NextResponse:{json:(body,opts={})=>({status:opts.status||200,body,cookies:{set(){}}})},after:()=>{}},
 'next/headers': {cookies:async()=>({getAll:()=>[],get:()=>undefined})},
 '@supabase/ssr':{createServerClient:()=>db},
 '@supabase/supabase-js':{createClient:()=>db},
 '@/lib/billing/subscriptions':{assertCanStartCheckout:async()=>{},assertCanStartCheckoutForEmail:async()=>{}},
 '@/lib/billing/payment-runtime-config':{resolvePaymentRuntime:()=>({stripeLive:false})},
 '@/lib/observability/payment-server':{captureServerPaymentFailure:x=>state.signals.push(x),flushServerPaymentTelemetry:async()=>{}},
 '@/lib/funnel/cookie':{FUNNEL_SESSION_COOKIE:'funnel',FUNNEL_TOUCH_COOKIE:'touch'},
 '@/lib/funnel/server':{resolveFunnelCookieContext:async()=>null},
 '@/lib/funnel/flags':{isPersonalPlanLaunchPricingEnabled:()=>false},
 '@/lib/billing/pricing-catalog':{resolveSubscriptionPricingCatalog:()=> 'standard',STANDARD_PRICING_CATALOG:'standard'},
 '@/lib/billing/offer-products':{PERSONAL_PLAN_ONCE_KIND:'personal_plan_once'},
 '@/lib/reactivation/return-destination':{sanitizeReactivationReturnDestination:x=>x||'/chat'},
 '@/lib/reactivation/checkout-reservations':{
  MembershipReactivationCheckoutConflictError:Conflict,
  acquireMembershipReactivationCheckout:async()=>reservation,
  claimMembershipReactivationProvider:async(_db,_id,_user,provider)=>{state.claims.push(provider);reservation.provider=provider;reservation.status='provider_selected';return reservation},
  bindMembershipReactivationProviderReference:async(_db,_id,ref)=>{reservation.provider_reference=ref;reservation.status='provider_created'}
 },
 '@/lib/stripe/pricing-plans':{getStripePricingPlan:()=>({amount:2999,currency:'eur',analyticsId:'premium_month'})},
 '@/lib/stripe/checkout-session-params':{buildStripeCheckoutSessionParams:params=>({customer:params.customerId,customer_email:params.customerEmail})},
 '@/lib/stripe/client':{
  getStripePriceId:()=> 'price_fixture',resolveStripePriceId:()=>({interval:'month',pricingCatalog:'standard'}),
  getStripe:()=>({checkout:{sessions:{create:async(params)=>{state.calls.push(params);if(params.customer==='cus_missing_fixture'){throw Object.assign(new Error('No such customer: fixture'),{code:'resource_missing',param:'customer',statusCode:400,type:'StripeInvalidRequestError'})}return {id:'cs_fixture',client_secret:'fixture-only'}}}}})
 }
};
// Replay the verified production baseline, not the subsequently repaired working tree.
const source=req('node:child_process').execFileSync('git', ['show', '5a3e33f1f641a8693209017ad25c4c9c69870df2:src/app/api/stripe/create-checkout-session/route.ts'], {cwd:repoRoot,encoding:'utf8'});
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exp={};
vm.runInNewContext(compiled,{exports:exp,require:name=>{if(name in overrides)return overrides[name];if(name==='zod'||name.startsWith('node:'))return req(name);return new Proxy({},{get:(_,key)=>{if(key==='__esModule')return false;return ()=>{throw new Error('Unexpected fixture dependency '+name+'.'+String(key))}}})},process:{env:{}},console,Buffer,URL,Date,setTimeout,clearTimeout});
(async()=>{
 let error;let response;
 try{response=await exp.POST({json:async()=>({interval:'month',source:'pricing_page',checkoutContext:'membership_reactivation',checkoutAttemptId:'00000000-0000-4000-8000-000000000003',returnDestination:'/chat'}),nextUrl:new URL('https://fixture.invalid/api/stripe/create-checkout-session')})}catch(e){error=e}
 console.log(JSON.stringify({mode,responseStatus:response?.status,errorCode:error?.code,error:error?.message,reservationStatus:reservation.status,providerReferencePresent:!!reservation.provider_reference,providerCalls:state.calls.length,telemetry:state.signals.map(x=>({errorFamily:x.errorFamily,status:x.status}))}));
 if(mode==='unauthenticated'){assert.equal(response.status,401);assert.equal(state.calls.length,0);return}
 assert.equal(error,undefined,'Checkout must not strand a reactivation on a stale customer reference');
 assert.equal(response.status,200);
})().catch(e=>{console.error(e.message);process.exitCode=1});
