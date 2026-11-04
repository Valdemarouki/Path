/* Collapsing changes the presentation only. Geometry and real edge endpoints stay intact. */
function canvasPresentation(board){
 const owner=new Map(),frames=board.nodes.filter(n=>n.kind==='group'&&n.collapsed).sort((a,b)=>(b.width||280)*(b.height||180)-(a.width||280)*(a.height||180));
 for(const frame of frames){if(owner.has(frame.id))continue;for(const child of canvasFrameContents(board,frame))if(!owner.has(child.id))owner.set(child.id,frame.id);}
 const nodes=board.nodes.filter(n=>!owner.has(n.id)).map(n=>n.kind==='group'&&n.collapsed?{...n,width:240,height:100,body:`Collapsed · ${canvasFrameContents(board,n).length} cards`}:n);
 const pairs=new Set(),edges=[];for(const [sourceIndex,edge] of (board.edges||[]).entries()){const from=owner.get(edge.from)||edge.from,to=owner.get(edge.to)||edge.to,key=JSON.stringify([from,to]);if(from===to||pairs.has(key))continue;pairs.add(key);edges.push({...edge,from,to,_sourceEdgeIndex:sourceIndex});}
 return {...board,nodes,edges};
}
function toggleCanvasFrame(board,id){const frame=board.nodes.find(n=>n.id===id&&n.kind==='group');if(!frame)return false;frame.collapsed=!frame.collapsed;return true;}
document.addEventListener('click',e=>{const b=e.target.closest('[data-canvas-collapse]');if(!b)return;const board=data.canvases.find(c=>c.id===canvasId);if(!board)return;if(toggleCanvasFrame(board,b.dataset.canvasCollapse)&&save()){canvasMultiSelection.clear();canvasSelected=b.dataset.canvasCollapse;render();focusCanvasCard(canvasSelected);}});
