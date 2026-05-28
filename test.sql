-- Active: 1778508155473@@127.0.0.1@5432@comfort_scoring


select * from otp_verifications ORDER BY created_at DESC limit 10;


delete from users;

select * from merchant_users;


select * FROM integration_logs ORDER BY created_at desc;

select *  from integration_logs ORDER BY CREATED_AT DESC limit 10;

select * from tariffs;

delete from tariffs where id = 5;

delete from deals;