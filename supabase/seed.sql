-- Optional starter data from the schedule supplied during TutorGrid planning.
-- Only rows with clear time data are included. Add Sathi/Shafin/Sharafat/Tasin/Shovon after confirming their exact times.
with ins(name,color) as (
 values ('Arman','#4f46e5'),('Mridila','#0891b2'),('Erina','#059669'),('Zihad','#ea580c'),('Siyam','#7c3aed'),('Raza','#ca8a04'),('Nayeem','#0f766e'),('Rudro','#2563eb'),('Sathi','#db2777'),('Shafin','#9333ea'),('Sharafat','#be123c'),('Tasin','#65a30d'),('Shovon','#475467')
)
insert into public.students(name,color) select name,color from ins where not exists(select 1 from public.students s where s.name=ins.name);

do $$
declare sid uuid;
begin
 select id into sid from students where name='Arman' limit 1; insert into schedules(student_id,day_of_week,start_time,duration_minutes) values(sid,1,'10:30',60),(sid,3,'10:30',60),(sid,5,'10:30',60);
 select id into sid from students where name='Mridila' limit 1; insert into schedules(student_id,day_of_week,start_time,duration_minutes) values(sid,0,'14:00',90),(sid,2,'14:00',90),(sid,4,'14:00',90);
 select id into sid from students where name='Erina' limit 1; insert into schedules(student_id,day_of_week,start_time,duration_minutes) values(sid,0,'17:00',90),(sid,2,'17:00',90),(sid,4,'17:00',90);
 select id into sid from students where name='Zihad' limit 1; insert into schedules(student_id,day_of_week,start_time,duration_minutes) values(sid,0,'15:00',60),(sid,2,'15:00',60),(sid,4,'15:00',60);
 select id into sid from students where name='Siyam' limit 1; insert into schedules(student_id,day_of_week,start_time,duration_minutes) values(sid,6,'08:00',60),(sid,0,'08:00',60),(sid,4,'08:00',60);
 select id into sid from students where name='Raza' limit 1; insert into schedules(student_id,day_of_week,start_time,duration_minutes) values(sid,1,'18:00',60),(sid,3,'18:00',60),(sid,5,'18:00',60);
 select id into sid from students where name='Nayeem' limit 1; insert into schedules(student_id,day_of_week,start_time,duration_minutes) values(sid,0,'07:00',60),(sid,2,'07:00',60),(sid,4,'07:00',60);
 select id into sid from students where name='Rudro' limit 1; insert into schedules(student_id,day_of_week,start_time,duration_minutes) values(sid,1,'19:00',60),(sid,3,'19:00',60),(sid,5,'19:00',60);
end $$;
