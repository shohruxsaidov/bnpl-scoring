import { autoPayClient } from '../../service/shared';

interface Payload {
  phone: string;
  pinfl: string;
}

const assertOk = () => {};
export const attachPhoneToClientHandler = async ({ phone, pinfl }: Payload) => {
  const client = autoPayClient();
  const body = {
    method: 'client.phone.add',
    params: {
      clients: [
        {
          pinfl,
          phones: [phone],
        },
      ],
    },
  };
  await client('/api/v1/partners', {
    json: body,
  });
};
