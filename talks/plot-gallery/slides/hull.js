// The example numbers are illustrative formation energies, not computed materials data.
Deck.hullChart({name:'hull',heading:'Binary formation-energy hull',points:[
  {x:0.25,e:-0.2,label:'A3B'},{x:0.5,e:-0.5,label:'AB'},{x:0.75,e:-0.15,label:'AB3'},{x:0.4,e:-0.15,label:'candidate'}],
  steps:[{caption:'Candidate compounds',state:{shown:4}},{caption:'Lower convex hull',state:{hull:true}},{caption:'Energy above hull',state:{drops:true}},{caption:'Focus the candidate',state:{focus:3}}],
  notes:'Illustrative data. Hull and distances are computed from every input point.'});
