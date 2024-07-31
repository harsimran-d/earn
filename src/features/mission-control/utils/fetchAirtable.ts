import { PromiserJson } from '@/utils/promiser';

import {
  airtableToStatus,
  statusToAirtable,
  syncSourceToTsxType,
  tsxTypeToSyncSource,
} from '.';
import { type PaymentData, type STATUS, type TSXTYPE } from './types';

interface AirtableUrlMakerOptions {
  fields: string[];
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

const airtableAPIUrl = `https://api.airtable.com/v0`;
export const airtableUrlMaker = (options: AirtableUrlMakerOptions): URL => {
  const airtableUrl = new URL(
    `${airtableAPIUrl}/${process.env.AIRTABLE_MISSION_CONTROL_BASE}/${process.env.AIRTABLE_MISSION_CONTROL_TABLE}`,
  );

  options.fields.forEach((field) => {
    airtableUrl.searchParams.append('fields[]', field);
  });

  if (options.sortField) {
    airtableUrl.searchParams.append('sort[0][field]', options.sortField);
    airtableUrl.searchParams.append(
      'sort[0][direction]',
      options.sortDirection || 'desc',
    );
  }

  return airtableUrl;
};

export interface FetchAirtableProps {
  airtableUrl: URL;
  customFilters?: string[];
  pageSize: number;
  id?: string;
  region?: string;
  regionKey?: string;
  status?: STATUS;
  statusKey?: string;
  type?: TSXTYPE;
  typeKey?: string;
  searchTerm?: string;
  searchKey?: string;
  offset?: string;
}

export async function fetchAirtable({
  airtableUrl,
  customFilters = [],
  pageSize,
  id,
  region,
  regionKey,
  status,
  statusKey,
  type,
  typeKey,
  searchTerm,
  searchKey,
  offset,
}: FetchAirtableProps) {
  // const airtableUrl = airtableUrlMaker();
  airtableUrl.searchParams.set('pageSize', pageSize + '');

  const filterFormulas: string[] = [...customFilters];

  if (id) {
    filterFormulas.push(`RECORD_ID()='${id}'`);
  }

  if (searchTerm && searchKey) {
    filterFormulas.push(`SEARCH("${searchTerm.toLowerCase()}", 
LOWER({${searchKey}}))`);
  }

  if (region && regionKey && region.toLowerCase() !== 'global') {
    filterFormulas.push(`SEARCH("${region.toLowerCase()}", 
LOWER({${regionKey}}))`);
  }

  if (status && statusKey && status !== 'all') {
    const statusValues = statusToAirtable(status);

    if (statusValues.length > 0) {
      const orConditions = statusValues.map(
        (statusValue) =>
          `SEARCH("${statusValue.toLowerCase()}", LOWER({${statusKey}}))`,
      );

      filterFormulas.push(`OR(${orConditions.join(', ')})`);
    }
  }

  if (type && typeKey && type !== 'all') {
    filterFormulas.push(`SEARCH("${tsxTypeToSyncSource(type).toLowerCase()}", 
LOWER({${typeKey}}))`);
  }

  if (filterFormulas.length > 0) {
    const combinedFilter =
      filterFormulas.length > 1
        ? `AND(${filterFormulas.join(',')})`
        : filterFormulas[0];
    if (combinedFilter) {
      airtableUrl.searchParams.append('filterByFormula', combinedFilter);
    }
  }

  if (offset) {
    airtableUrl.searchParams.append('offset', offset);
  }

  // console.log(airtableUrl);

  const fetchReq = fetch(airtableUrl.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_MISSION_CONTROL_TOKEN}`,
    },
  });
  const [parsedData, fetchError] = await PromiserJson<any>(fetchReq);
  if (fetchError) {
    console.log(fetchError.error);
    throw new Error(
      fetchError.message ?? `Something went wrong whilte fetching Data`,
    );
  }

  const data: PaymentData[] = [];

  let currentData: any;
  for (let i = 0; i < parsedData.records.length; i++) {
    currentData = {
      ...parsedData.records[i].fields,
      id: parsedData.records[i].id,
    };
    // console.log(currentData);
    data.push({
      id: currentData.id as string,
      type: syncSourceToTsxType(currentData['Sync Source']) || null,
      status:
        airtableToStatus(
          currentData['Status'],
          currentData['Payment Status']?.[0],
        ) || null,
      title: currentData['Purpose of Payment Main'] || null,
      date: currentData['Application Time'] || null,
      name: currentData['Name'] || null,
      amount: currentData['Amount'] || null,
      email: currentData['Contact Email'] || null,
      tokenSymbol: 'USDC',
      kycLink: currentData['KYC']?.[0].url ?? null,
      discordId: currentData['Discord Handle'] || null,
      walletAddress: currentData['SOL Wallet'] || null,
      region: currentData['Region'] || null,
      recordId: currentData['RecordID'] || null,
      earnId: currentData['earnApplicationId'] || null,
      shortTitle: currentData['Title'] || null,
      summary: currentData['Summary'] || null,
      description: currentData['Description'] || null,
      deadline: currentData['Deadline'] || null,
      proofOfWork: currentData['Proof of Work'] || null,
      milestones: currentData['Milestones'] || null,
      kpi: currentData['KPI'] || null,
      telegram: currentData['Telegram'] || null,
      category: currentData['Category'] || null,
      approver: currentData['Approver'] || null,
    });
  }

  return {
    data,
    nextOffset: (parsedData.offset as string) || null,
  };
}