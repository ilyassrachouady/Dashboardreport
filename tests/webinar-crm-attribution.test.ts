import test from "node:test";
import assert from "node:assert/strict";
import {emptyDataset} from "../lib/model";
import {webinarCrmAttribution} from "../lib/webinar-crm-attribution";
test("CRM attribution groups the session cohort, preserves unknowns and deduplicates bookings",()=>{
 const d=emptyDataset();
 d.contacts=["a","b","other"].map(id=>({id,ghl_contact_id:id,email:`${id}@example.com`,first_name:id,last_name:"",phone:null,trakyo_id:null,created_at:""}));
 d.registrations=[{id:"r",contact_id:"a",webinar_id:"w",registered_at:"",raw_utm_source:"",raw_utm_medium:"",raw_utm_campaign:"",raw_utm_content:""}];
 d.appointments=["a","a","b"].map((contact_id,i)=>({id:String(i),contact_id,webinar_id:"w",status:"confirmed",scheduled_at:"",booked_at:"",closer:""}));
 d.crmAttribution=[{ghl_contact_id:"a",source:"ig",content:"IG bio",campaign:"",firstTouch:"",lastTouch:""},{ghl_contact_id:"other",source:"Email",content:"",campaign:"",firstTouch:"",lastTouch:""}];
 assert.deepEqual(webinarCrmAttribution(d,"w","source"),[{name:"Instagram",contacts:1,booked:1},{name:"Unattributed",contacts:1,booked:1}]);
 assert.deepEqual(webinarCrmAttribution(d,"w","campaign"),[{name:"Unattributed",contacts:2,booked:2}]);
 assert.deepEqual(webinarCrmAttribution(d,"other","source"),[]);
});
