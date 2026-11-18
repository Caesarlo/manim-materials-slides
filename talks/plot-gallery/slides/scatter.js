// Illustrative scatter data with a target region and selected points.
{
  const points=[{x:1,y:3,group:0,label:'A1'},{x:3,y:6,group:0},{x:12,y:15,group:1,label:'B1'},{x:40,y:12,group:1},{x:100,y:45,group:2,label:'C1'}];
  const region={x0:1,x1:20,y0:10,y1:100};
  Deck.scatterChart({name:'scatter',heading:'Candidate performance',points,groups:[{name:'A'},{name:'B'},{name:'C'}],
    x:{domain:[1,1000],type:'log',label:'Conductivity'},y:{domain:[1,100],type:'log',label:'Performance'},
    steps:[{caption:'First group',state:{groupsShown:1}},{caption:'All groups',state:{groupsShown:3}},{caption:'Target region',state:{region}},{caption:'Candidates',state:{highlight:Deck.pointsInRegion(points,region),labels:true}}],
    notes:'Illustrative data.'});
}
