ALTER TABLE "merchant_users" RENAME COLUMN "email" TO "phone";
ALTER TABLE "merchant_users" ALTER COLUMN "phone" TYPE varchar(20);
