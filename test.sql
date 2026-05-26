-- Active: 1778508155473@@127.0.0.1@5432@comfort_scoring


select * from otp_verifications ORDER BY created_at DESC limit 10;


delete from users;

select * from merchant_users;


select * FROM integration_logs ORDER BY created_at desc;

delete from integration_logs;