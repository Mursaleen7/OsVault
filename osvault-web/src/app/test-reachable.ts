/**
 * Test file to demonstrate REACHABLE vulnerability detection
 * This file imports lodash, so the vulnerability will be marked as REACHABLE
 */

import _ from 'lodash';

export function testReachableVulnerability() {
  // Using lodash - this makes the CVE-2021-23337 vulnerability REACHABLE
  const data = [1, 2, 3, 4, 5, 6];
  const chunked = _.chunk(data, 2);
  
  console.log('Chunked data:', chunked);
  return chunked;
}

// This proves lodash is actually used in the codebase
// OsVault will detect this import and mark the vulnerability as 🚨 REACHABLE
