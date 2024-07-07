import type { GetServerSideProps, NextPage } from 'next';

import { getURL } from '@/utils/validUrl';

interface ApiResponse {
  type?: string;
}

const Bounty: NextPage = () => {
  return null;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { slug } = context.params as { slug: string };
  const res = await fetch(`${getURL()}api/sponsor-dashboard/${slug}`);
  const data: ApiResponse = await res.json();

  if (data.type) {
    return {
      redirect: {
        destination: `/listings/${data.type}/${slug}/`,
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default Bounty;
