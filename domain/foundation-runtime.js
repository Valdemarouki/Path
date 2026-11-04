/* Read-side facade only. Legacy data is not migrated or assigned an owner on startup. */
const pathEntityRepository=new PathEntityRepository(()=>data);
findTask=function(id){return pathEntityRepository.task(id);};
