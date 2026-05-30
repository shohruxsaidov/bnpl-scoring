-- A scoring run is recorded the moment KATM + card scoring completes, before any
-- deal exists. Allow client_scorings.deal_id to be NULL and link it to a deal
-- later if the wizard reaches deal creation.
ALTER TABLE "client_scorings" ALTER COLUMN "deal_id" DROP NOT NULL;
