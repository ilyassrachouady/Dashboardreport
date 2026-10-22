import { NextResponse } from "next/server";
import { z } from "zod";
import { database, isDemo } from "../../../lib/db";
import { sameOrigin } from "../../../lib/same-origin";
import { notionEventChoices, notionSessionMap } from "../../../lib/integrations/notion";
import { webinarTagMap } from "../../../lib/integrations/ghl-webinar";
export async function GET(){
 if(isDemo())return NextResponse.json({events:[]});
 try{return NextResponse.json({events:await notionEventChoices()},{headers:{"Cache-Control":"private, no-store"}});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Notion events unavailable"},{status:502});}
}
const schema=z.object({id:z.uuid(),notion_page_id:z.uuid(),ghl_cohort_tag:z.string().trim().max(200).transform(v=>v||null)}).strict();
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:"Invalid origin"},{status:403});
 if(isDemo())return NextResponse.json({error:"Connections cannot be changed in demo mode."},{status:409});
 const input=schema.safeParse(await request.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Select a session and Notion event."},{status:400});
 try{
  const db=database(),sessions=await db.from("webinars").select("*");
  if(sessions.error)throw Error("Session lookup failed");
  const current=sessions.data.find(w=>w.id===input.data.id);
  if(!current)return NextResponse.json({error:"Session not found"},{status:404});
  const map=notionSessionMap(sessions.data),tagMap=webinarTagMap(sessions.data), normalized=input.data.notion_page_id.replaceAll("-","");
  if(Object.entries(map).some(([external,page])=>external!==current.external_id&&page.replaceAll("-","")===normalized))return NextResponse.json({error:"That Notion event is already connected to another session."},{status:409});
  if(input.data.ghl_cohort_tag && Object.entries(tagMap).some(([external,tag])=>external!==current.external_id&&tag===input.data.ghl_cohort_tag))return NextResponse.json({error:"Use a separate GHL cohort tag for each webinar session."},{status:409});
  const events=await notionEventChoices(),event=events.find(e=>e.id.replaceAll("-","")===normalized);
  if(!event)return NextResponse.json({error:"Choose an event from the connected Notion Client Events database."},{status:400});
  const saved=await db.from("webinars").update({notion_page_id:input.data.notion_page_id,notion_page_url:event.url,ghl_cohort_tag:input.data.ghl_cohort_tag}).eq("id",input.data.id).select("id").single();
  if(saved.error)return NextResponse.json({error:"Connection could not be saved. Ask your administrator to enable webinar connections."},{status:502});
  return NextResponse.json({saved:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Connection failed"},{status:502});}
}
