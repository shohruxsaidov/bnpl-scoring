import { autoPayClient } from '../../service/shared';

interface Payload {
  pinfl: string;
  firstName: string;
  lastName: string;
  middleName: string;
  passportSeries: string;
  passportNumber: string;
}

const assertOk = () => {};
export const createClientHandler = async ({
  firstName,
  lastName,
  middleName,
  passportSeries,
  passportNumber,
  pinfl,
}: Payload) => {
  const client = autoPayClient();
  const body = {
    method: 'client.create',
    params: {
      clients: [
        {
          pinfl,
          passport: `${passportSeries}${passportNumber}`,
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName,
        },
      ],
    },
  };
  const res = await client('/api/v1/partners', {
    method: 'POST',
    json: body,
  });
  console.log(`Creating client response`);
  return res;
};
