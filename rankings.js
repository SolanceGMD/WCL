import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const cfg=window.WCL_CONFIG||{};
const db=createClient(cfg.supabaseUrl||"https://xvdinlyertutpddeilvq.supabase.co",cfg.supabaseKey||"sb_publishable_J0xpFgrZCYfTFY15AsHAFA_QYjZzyMB");
const root=document.querySelector("#leaderboard");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function load(){root.innerHTML='<p class="empty-state">Loading scores…</p>';const {data,error}=await db.from("profiles").select("id,gd_username,points,created_at").order("points",{ascending:false}).order("created_at",{ascending:true}).limit(200);if(error){root.textContent="Could not load rankings: "+error.message;return;}if(!data?.length){root.innerHTML='<p class="empty-state">No players yet. The first approved completions will appear here.</p>';return;}root.innerHTML=data.map((p,i)=>'<div class="ranking-row"><span class="place">#'+(i+1)+'</span><b>'+esc(p.gd_username||"Player")+'</b><strong>'+Number(p.points||0).toLocaleString()+' pts</strong></div>').join("");}
document.querySelector("#refresh")?.addEventListener("click",load);load();