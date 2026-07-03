const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { getAccessToken } = require('./zohoAuth');

// Configure paths
const EXPORTS_DIR = './exports';
const PROCESSED_DIR = path.join(__dirname, 'processed');

// Campaign mapping (keep this as it's still needed)
const CAMPAIGN_MAPPING = {
    'AL-PAVET': '67770d61e345699491e695ca',
    'AK-PAVET': '67770de8e345699491e69ce2',
    'AZ-PAVET': '67770dfde345699491e69d98',
    'AR-PAVET': '67770e13e345699491e69e66',
    'CA-PAVET': '67770e71e345699491e6a727',
    'CO-PAVET': '67770f14e345699491e6b502',
    'CT-PAVET': '67770f49e345699491e6ba73',
    'DE-PAVET': '67771027e345699491e6cc2a',
    'DC-PAVET': '6777103be345699491e6ce05',
    'FL-PAVET': '6777104ee345699491e6d012',
    'GA-PAVET': '67771062e345699491e6d1bb',
    'HI-PAVET': '67771076e345699491e6d3d3',
    'ID-PAVET': '67771090e345699491e6d5fc',
    'IL-PAVET': '677710a8e345699491e6d8bf',
    'IN-PAVET': '677710c5e345699491e6dc6f',
    'IA-PAVET': '677711ace345699491e6ee5c',
    'KS-PAVET': '677711cae345699491e6f00b',
    'KY-PAVET': '67771231e345699491e6f553',
    'LA-PAVET': '67771246e345699491e6f723',
    'ME-PAVET': '67771265e345699491e6fa37',
    'MD-PAVET': '67771276e345699491e6fb9b',
    'MA-PAVET': '67771296e345699491e6fea5',
    'MI-PAVET': '677712aee345699491e700ae',
    'MN-PAVET': '677712bfe345699491e70224',
    'MS-PAVET': '677712d0e345699491e703b7',
    'MO-PAVET': '677712e1e345699491e70544',
    'MT-PAVET': '677712f4e345699491e70703',
    'NE-PAVET': '67771325e345699491e70bb2',
    'NV-PAVET': '67771336e345699491e70d86',
    'NH-PAVET': '67771348e345699491e70f5f',
    'NJ-PAVET': '6777135ae345699491e71133',
    'NM-PAVET': '67771472e345699491e7241a',
    'NY-PAVET': '67771487e345699491e725e7',
    'NC-PAVET': '677714c6e345699491e72bc6',
    'ND-PAVET': '67771505e345699491e732b9',
    'OH-PAVET': '67771515e345699491e73442',
    'OK-PAVET': '67771527e345699491e73757',
    'OR-PAVET': '67771534e345699491e738aa',
    'PA-PAVET': '6777154ee345699491e73b48',
    'RI-PAVET': '67771587e345699491e74080',
    'SC-PAVET': '677715a4e345699491e7435e',
    'SD-PAVET': '677715b5e345699491e744fe',
    'TN-PAVET': '677715d7e345699491e747c6',
    'TX-PAVET': '677715ede345699491e74897',
    'UT-PAVET': '677715fde345699491e74921',
    'VT-PAVET': '6777160de345699491e749d8',
    'VA-PAVET': '67771621e345699491e74ba1',
    'WA-PAVET': '67771634e345699491e74d90',
    'WV-PAVET': '67771646e345699491e7545f',
    'WI-PAVET': '67771657e345699491e75b16',
    'WY-PAVET': '6777166ae345699491e75ca4',
    'AL-VN125': '677ab08027b78ac01f4b99dc',
    'AK-VN125': '677ab16c27b78ac01f4ba371',
    'AZ-VN125': '677ab18327b78ac01f4ba4e7',
    'AR-VN125': '677ab19727b78ac01f4ba636',
    'CA-VN125': '677ab30327b78ac01f4bbd37',
    'CO-VN125': '677ab31727b78ac01f4bbd6c',
    'CT-VN125': '677ab33127b78ac01f4bbdb5',
    'DE-VN125': '677ab35927b78ac01f4bc05c',
    'DC-VN125': '677ab36e27b78ac01f4bc1ce',
    'FL-VN125': '677ab38727b78ac01f4bc35a',
    'GA-VN125': '677ab39a27b78ac01f4bc49c',
    'HI-VN125': '677ab3ec27b78ac01f4bc5db',
    'ID-VN125': '677ab41c27b78ac01f4bc80d',
    'IL-VN125': '677ab42c27b78ac01f4bc936',
    'IN-VN125': '677ab43f27b78ac01f4bca84',
    'IA-VN125': '677ab45427b78ac01f4bcbcf',
    'KS-VN125': '677ab46727b78ac01f4bcd05',
    'KY-VN125': '677ab47727b78ac01f4bce0c',
    'LA-VN125': '677ab48b27b78ac01f4bcfc3',
    'ME-VN125': '677ab49b27b78ac01f4bd0c2',
    'MD-VN125': '677ab4b127b78ac01f4bd221',
    'MA-VN125': '677ab4c627b78ac01f4bd35d',
    'MI-VN125': '677ab4da27b78ac01f4bd4a0',
    'MN-VN125': '677ab4e927b78ac01f4bd59a',
    'MS-VN125': '677ab50b27b78ac01f4bd79c',
    'MO-VN125': '677ab51f27b78ac01f4bd8cd',
    'MT-VN125': '677ab53e27b78ac01f4bda8d',
    'NE-VN125': '677ab57727b78ac01f4bdef4',
    'NV-VN125': '677ab5a127b78ac01f4be170',
    'NH-VN125': '677ab5b627b78ac01f4be330',
    'NJ-VN125': '677ab6e627b78ac01f4bef52',
    'NM-VN125': '677ab7eb27b78ac01f4bffc1',
    'NY-VN125': '677ab80b27b78ac01f4c0141',
    'NC-VN125': '677ab81827b78ac01f4c015a',
    'ND-VN125': '677ab82c27b78ac01f4c016e',
    'OH-VN125': '677ab88127b78ac01f4c02d9',
    'OK-VN125': '677ab8cb27b78ac01f4c05b5',
    'OR-VN125': '677ab8d927b78ac01f4c0693',
    'PA-VN125': '677ab91427b78ac01f4c0a18',
    'RI-VN125': '677ab92427b78ac01f4c0b16',
    'SC-VN125': '677ab92f27b78ac01f4c0c39',
    'SD-VN125': '677ab96127b78ac01f4c0f9f',
    'TN-VN125': '677ab97027b78ac01f4c1094',
    'TX-VN125': '677ab97b27b78ac01f4c113d',
    'UT-VN125': '677abb5d27b78ac01f4c269c',
    'VT-VN125': '677abb7227b78ac01f4c2808',
    'VA-VN125': '677abb8027b78ac01f4c2908',
    'WA-VN125': '677abc1627b78ac01f4c3298',
    'WV-VN125': '677abc2327b78ac01f4c3357',
    'WI-VN125': '677abc3727b78ac01f4c3496',
    'WY-VN125': '677abc4727b78ac01f4c3587',
    'AL-NCL05': '677ab0a727b78ac01f4b9a0f',
    'AK-NCL05': '677abd4727b78ac01f4c40e8',
    'AZ-NCL05': '677abd5527b78ac01f4c4108',
    'AR-NCL05': '677abde327b78ac01f4c4ac4',
    'CA-NCL05': '677abdf327b78ac01f4c4bba',
    'CO-NCL05': '677abe0127b78ac01f4c4cb8',
    'CT-NCL05': '677abe0c27b78ac01f4c4d77',
    'DE-NCL05': '677abe3827b78ac01f4c5025',
    'DC-NCL05': '677abe4527b78ac01f4c50f4',
    'FL-NCL05': '677abe5627b78ac01f4c51fb',
    'GA-NCL05': '677abe8727b78ac01f4c5590',
    'HI-NCL05': '677abe9427b78ac01f4c568b',
    'ID-NCL05': '677abead27b78ac01f4c5858',
    'IL-NCL05': '677abef027b78ac01f4c5dc4',
    'IN-NCL05': '677abf3b27b78ac01f4c6240',
    'IA-NCL05': '677abfad27b78ac01f4c63a9',
    'KS-NCL05': '677abfcd27b78ac01f4c65be',
    'KY-NCL05': '677abfe427b78ac01f4c6736',
    'LA-NCL05': '677ac01427b78ac01f4c6a6d',
    'ME-NCL05': '677ac03427b78ac01f4c6c9f',
    'MD-NCL05': '677ac07e27b78ac01f4c71ec',
    'MA-NCL05': '677ac0c127b78ac01f4c769f',
    'MI-NCL05': '677ac0ce27b78ac01f4c7798',
    'MN-NCL05': '677ac0da27b78ac01f4c7857',
    'MS-NCL05': '677ac10d27b78ac01f4c7bac',
    'MO-NCL05': '677ac11a27b78ac01f4c7c47',
    'MT-NCL05': '677ac13327b78ac01f4c7c59',
    'NE-NCL05': '677ac14427b78ac01f4c7c70',
    'NV-NCL05': '677ac15027b78ac01f4c7c89',
    'NH-NCL05': '677ac18027b78ac01f4c7d8e',
    'NJ-NCL05': '677ac18b27b78ac01f4c7db3',
    'NM-NCL05': '677ac19727b78ac01f4c7de2',
    'NY-NCL05': '677ac1a827b78ac01f4c7ef2',
    'NC-NCL05': '677ac1b427b78ac01f4c7fc0',
    'ND-NCL05': '677ac1bf27b78ac01f4c8080',
    'OH-NCL05': '677ac1f827b78ac01f4c826a',
    'OK-NCL05': '677ac20627b78ac01f4c8290',
    'OR-NCL05': '677ac21127b78ac01f4c8345',
    'PA-NCL05': '677ac21f27b78ac01f4c843e',
    'RI-NCL05': '677ac24127b78ac01f4c8633',
    'SC-NCL05': '677ac24f27b78ac01f4c870c',
    'SD-NCL05': '677ac25a27b78ac01f4c87ba',
    'TN-NCL05': '677ac26527b78ac01f4c8872',
    'TX-NCL05': '677ac27227b78ac01f4c8941',
    'UT-NCL05': '677ac27d27b78ac01f4c8a00',
    'VT-NCL05': '677ac29027b78ac01f4c8b3d',
    'VA-NCL05': '677ac29d27b78ac01f4c8c56',
    'WA-NCL05': '677ac2b227b78ac01f4c8daa',
    'WV-NCL05': '677ac2c027b78ac01f4c8e88',
    'WI-NCL05': '677ac2ce27b78ac01f4c8f50',
    'WY-NCL05': '677ac2da27b78ac01f4c9011',
    'AL-NCL06': '677ac0c627b78ac01f4c7265',
    'AK-NCL06': '677abd4727b78ac01f4c40e8',
    'AZ-NCL06': '677abd5527b78ac01f4c4108',
    'AR-NCL06': '677abde327b78ac01f4c4ac4',
    'CA-NCL06': '677abdf327b78ac01f4c4bba',
    'CO-NCL06': '677abe0127b78ac01f4c4cb8',
    'CT-NCL06': '677abe0c27b78ac01f4c4d77',
    'DE-NCL06': '677abe3827b78ac01f4c5025',
    'DC-NCL06': '677abe4527b78ac01f4c50f4',
    'FL-NCL06': '677abe5627b78ac01f4c51fb',
    'GA-NCL06': '677abe8727b78ac01f4c5590',
    'HI-NCL06': '677abe9427b78ac01f4c568b',
    'ID-NCL06': '677abead27b78ac01f4c5858',
    'IL-NCL06': '677abef027b78ac01f4c5dc4',
    'IN-NCL06': '677abf3b27b78ac01f4c6240',
    'IA-NCL06': '677abfad27b78ac01f4c63a9',
    'KS-NCL06': '677abfcd27b78ac01f4c65be',
    'KY-NCL06': '677abfe427b78ac01f4c6736',
    'LA-NCL06': '677ac01427b78ac01f4c6a6d',
    'ME-NCL06': '677ac03427b78ac01f4c6c9f',
    'MD-NCL06': '677ac07e27b78ac01f4c71ec',
    'MA-NCL06': '677ac0c127b78ac01f4c769f',
    'MI-NCL06': '677ac0ce27b78ac01f4c7798',
    'MN-NCL06': '677ac0da27b78ac01f4c7857',
    'MS-NCL06': '677ac10d27b78ac01f4c7bac',
    'MO-NCL06': '677ac11a27b78ac01f4c7c47',
    'MT-NCL06': '677ac13327b78ac01f4c7c59',
    'NE-NCL06': '677ac14427b78ac01f4c7c70',
    'NV-NCL06': '677ac15027b78ac01f4c7c89',
    'NH-NCL06': '677ac18027b78ac01f4c7d8e',
    'NJ-NCL06': '677ac18b27b78ac01f4c7db3',
    'NM-NCL06': '677ac19727b78ac01f4c7de2',
    'NY-NCL06': '677ac1a827b78ac01f4c7ef2',
    'NC-NCL06': '677ac1b427b78ac01f4c7fc0',
    'ND-NCL06': '677ac1bf27b78ac01f4c8080',
    'OH-NCL06': '677ac1f827b78ac01f4c826a',
    'OK-NCL06': '677ac20627b78ac01f4c8290',
    'OR-NCL06': '677ac21127b78ac01f4c8345',
    'PA-NCL06': '677ac21f27b78ac01f4c843e',
    'RI-NCL06': '677ac24127b78ac01f4c8633',
    'SC-NCL06': '677ac24f27b78ac01f4c870c',
    'SD-NCL06': '677ac25a27b78ac01f4c87ba',
    'TN-NCL06': '677ac26527b78ac01f4c8872',
    'TX-NCL06': '677ac27227b78ac01f4c8941',
    'UT-NCL06': '677ac27d27b78ac01f4c8a00',
    'VT-NCL06': '677ac29027b78ac01f4c8b3d',
    'VA-NCL06': '677ac29d27b78ac01f4c8c56',
    'WA-NCL06': '677ac2b227b78ac01f4c8daa',
    'WV-NCL06': '677ac2c027b78ac01f4c8e88',
    'WI-NCL06': '677ac2ce27b78ac01f4c8f50',
    'WY-NCL06': '677ac2da27b78ac01f4c9011',
    'AL-NCL07': '677ab0a727b78ac01f4b9a0f',
    'FL-NCL07': '677abe5627b78ac01f4c51fb',
    'GA-NCL07': '677abe8727b78ac01f4c5590',
    'NC-NCL07': '67847e9f477432a7c853f1f5',
    'PA-NCL07': '67847eb7477432a7c853f203',
    'TX-NCL07': '67847eca477432a7c853f446',
    'AL-VET06': '67770d61e345699491e695ca',
    'AK-VET06': '67770de8e345699491e69ce2',
    'AZ-VET06': '67770dfde345699491e69d98',
    'AR-VET06': '67770e13e345699491e69e66',
    'CA-VET06': '67770e71e345699491e6a727',
    'CO-VET06': '67770f14e345699491e6b502',
    'CT-VET06': '67770f49e345699491e6ba73',
    'DE-VET06': '67771027e345699491e6cc2a',
    'DC-VET06': '6777103be345699491e6ce05',
    'FL-VET06': '6777104ee345699491e6d012',
    'GA-VET06': '67771062e345699491e6d1bb',
    'HI-VET06': '67771076e345699491e6d3d3',
    'ID-VET06': '67771090e345699491e6d5fc',
    'IL-VET06': '677710a8e345699491e6d8bf',
    'IN-VET06': '677710c5e345699491e6dc6f',
    'IA-VET06': '677711ace345699491e6ee5c',
    'KS-VET06': '677711cae345699491e6f00b',
    'KY-VET06': '67771231e345699491e6f553',
    'LA-VET06': '67771246e345699491e6f723',
    'ME-VET06': '67771265e345699491e6fa37',
    'MD-VET06': '67771276e345699491e6fb9b',
    'MA-VET06': '67771296e345699491e6fea5',
    'MI-VET06': '677712aee345699491e700ae',
    'MN-VET06': '677712bfe345699491e70224',
    'MS-VET06': '677712d0e345699491e703b7',
    'MO-VET06': '677712e1e345699491e70544',
    'MT-VET06': '677712f4e345699491e70703',
    'NE-VET06': '67771325e345699491e70bb2',
    'NV-VET06': '67771336e345699491e70d86',
    'NH-VET06': '67771348e345699491e70f5f',
    'NJ-VET06': '6777135ae345699491e71133',
    'NM-VET06': '67771472e345699491e7241a',
    'NY-VET06': '67771487e345699491e725e7',
    'NC-VET06': '677714c6e345699491e72bc6',
    'ND-VET06': '67771505e345699491e732b9',
    'OH-VET06': '67771515e345699491e73442',
    'OK-VET06': '67771527e345699491e73757',
    'OR-VET06': '67771534e345699491e738aa',
    'PA-VET06': '6777154ee345699491e73b48',
    'RI-VET06': '67771587e345699491e74080',
    'SC-VET06': '677715a4e345699491e7435e',
    'SD-VET06': '677715b5e345699491e744fe',
    'TN-VET06': '677715d7e345699491e747c6',
    'TX-VET06': '677715ede345699491e74897',
    'UT-VET06': '677715fde345699491e74921',
    'VT-VET06': '6777160de345699491e749d8',
    'VA-VET06': '67771621e345699491e74ba1',
    'WA-VET06': '67771634e345699491e74d90',
    'WV-VET06': '67771646e345699491e7545f',
    'WI-VET06': '67771657e345699491e75b16',
    'WY-VET06': '6777166ae345699491e75ca4',
    'AL-GLOBE': '67981eb12b9e2ee73d91b069',
    'AK-GLOBE': '67981eb12b9e2ee73d91b069',
    'AZ-GLOBE': '67981eb12b9e2ee73d91b069',
    'AR-GLOBE': '67981eb12b9e2ee73d91b069',
    'CA-GLOBE': '67981eb12b9e2ee73d91b069',
    'CO-GLOBE': '67981eb12b9e2ee73d91b069',
    'CT-GLOBE': '67981eb12b9e2ee73d91b069',
    'DE-GLOBE': '67981eb12b9e2ee73d91b069',
    'DC-GLOBE': '67981eb12b9e2ee73d91b069',
    'FL-GLOBE': '67981eb12b9e2ee73d91b069',
    'GA-GLOBE': '67981eb12b9e2ee73d91b069',
    'HI-GLOBE': '67981eb12b9e2ee73d91b069',
    'ID-GLOBE': '67981eb12b9e2ee73d91b069',
    'IL-GLOBE': '67981eb12b9e2ee73d91b069',
    'IN-GLOBE': '67981eb12b9e2ee73d91b069',
    'IA-GLOBE': '67981eb12b9e2ee73d91b069',
    'KS-GLOBE': '67981eb12b9e2ee73d91b069',
    'KY-GLOBE': '67981eb12b9e2ee73d91b069',
    'LA-GLOBE': '67981eb12b9e2ee73d91b069',
    'ME-GLOBE': '67981eb12b9e2ee73d91b069',
    'MD-GLOBE': '67981eb12b9e2ee73d91b069',
    'MA-GLOBE': '67981eb12b9e2ee73d91b069',
    'MI-GLOBE': '67981eb12b9e2ee73d91b069',
    'MN-GLOBE': '67981eb12b9e2ee73d91b069',
    'MS-GLOBE': '67981eb12b9e2ee73d91b069',
    'MO-GLOBE': '67981eb12b9e2ee73d91b069',
    'MT-GLOBE': '67981eb12b9e2ee73d91b069',
    'NE-GLOBE': '67981eb12b9e2ee73d91b069',
    'NV-GLOBE': '67981eb12b9e2ee73d91b069',
    'NH-GLOBE': '67981eb12b9e2ee73d91b069',
    'NJ-GLOBE': '67981eb12b9e2ee73d91b069',
    'NM-GLOBE': '67981eb12b9e2ee73d91b069',
    'NY-GLOBE': '67981eb12b9e2ee73d91b069',
    'NC-GLOBE': '67981eb12b9e2ee73d91b069',
    'ND-GLOBE': '67981eb12b9e2ee73d91b069',
    'OH-GLOBE': '67981eb12b9e2ee73d91b069',
    'OK-GLOBE': '67981eb12b9e2ee73d91b069',
    'OR-GLOBE': '67981eb12b9e2ee73d91b069',
    'PA-GLOBE': '67981eb12b9e2ee73d91b069',
    'RI-GLOBE': '67981eb12b9e2ee73d91b069',
    'SC-GLOBE': '67981eb12b9e2ee73d91b069',
    'SD-GLOBE': '67981eb12b9e2ee73d91b069',
    'TN-GLOBE': '67981eb12b9e2ee73d91b069',
    'TX-GLOBE': '67981eb12b9e2ee73d91b069',
    'UT-GLOBE': '67981eb12b9e2ee73d91b069',
    'VT-GLOBE': '67981eb12b9e2ee73d91b069',
    'VA-GLOBE': '67981eb12b9e2ee73d91b069',
    'WA-GLOBE': '67981eb12b9e2ee73d91b069',
    'WV-GLOBE': '67981eb12b9e2ee73d91b069',
    'WI-GLOBE': '67981eb12b9e2ee73d91b069',
    'WY-GLOBE': '67981eb12b9e2ee73d91b069',
    'AL-VN071': '677ab08027b78ac01f4b99dc',
    'AK-VN071': '677ab16c27b78ac01f4ba371',
    'AZ-VN071': '677ab18327b78ac01f4ba4e7',
    'AR-VN071': '677ab19727b78ac01f4ba636',
    'CA-VN071': '677ab30327b78ac01f4bbd37',
    'CO-VN071': '677ab31727b78ac01f4bbd6c',
    'CT-VN071': '677ab33127b78ac01f4bbdb5',
    'DE-VN071': '677ab35927b78ac01f4bc05c',
    'DC-VN071': '677ab36e27b78ac01f4bc1ce',
    'FL-VN071': '677ab38727b78ac01f4bc35a',
    'GA-VN071': '677ab39a27b78ac01f4bc49c',
    'HI-VN071': '677ab3ec27b78ac01f4bc5db',
    'ID-VN071': '677ab41c27b78ac01f4bc80d',
    'IL-VN071': '677ab42c27b78ac01f4bc936',
    'IN-VN071': '677ab43f27b78ac01f4bca84',
    'IA-VN071': '677ab45427b78ac01f4bcbcf',
    'KS-VN071': '677ab46727b78ac01f4bcd05',
    'KY-VN071': '677ab47727b78ac01f4bce0c',
    'LA-VN071': '677ab48b27b78ac01f4bcfc3',
    'ME-VN071': '677ab49b27b78ac01f4bd0c2',
    'MD-VN071': '677ab4b127b78ac01f4bd221',
    'MA-VN071': '677ab4c627b78ac01f4bd35d',
    'MI-VN071': '677ab4da27b78ac01f4bd4a0',
    'MN-VN071': '677ab4e927b78ac01f4bd59a',
    'MS-VN071': '677ab50b27b78ac01f4bd79c',
    'MO-VN071': '677ab51f27b78ac01f4bd8cd',
    'MT-VN071': '677ab53e27b78ac01f4bda8d',
    'NE-VN071': '677ab57727b78ac01f4bdef4',
    'NV-VN071': '677ab5a127b78ac01f4be170',
    'NH-VN071': '677ab5b627b78ac01f4be330',
    'NJ-VN071': '677ab6e627b78ac01f4bef52',
    'NM-VN071': '677ab7eb27b78ac01f4bffc1',
    'NY-VN071': '677ab80b27b78ac01f4c0141',
    'NC-VN071': '677ab81827b78ac01f4c015a',
    'ND-VN071': '677ab82c27b78ac01f4c016e',
    'OH-VN071': '677ab88127b78ac01f4c02d9',
    'OK-VN071': '677ab8cb27b78ac01f4c05b5',
    'OR-VN071': '677ab8d927b78ac01f4c0693',
    'PA-VN071': '677ab91427b78ac01f4c0a18',
    'RI-VN071': '677ab92427b78ac01f4c0b16',
    'SC-VN071': '677ab92f27b78ac01f4c0c39',
    'SD-VN071': '677ab96127b78ac01f4c0f9f',
    'TN-VN071': '677ab97027b78ac01f4c1094',
    'TX-VN071': '677ab97b27b78ac01f4c113d',
    'UT-VN071': '677abb5d27b78ac01f4c269c',
    'VT-VN071': '677abb7227b78ac01f4c2808',
    'VA-VN071': '677abb8027b78ac01f4c2908',
    'WA-VN071': '677abc1627b78ac01f4c3298',
    'WV-VN071': '677abc2327b78ac01f4c3357',
    'WI-VN071': '677abc3727b78ac01f4c3496',
    'WY-VN071': '677abc4727b78ac01f4c3587',
    'AL-VN029': '677ab08027b78ac01f4b99dc',
    'AK-VN029': '677ab16c27b78ac01f4ba371',
    'AZ-VN029': '677ab18327b78ac01f4ba4e7',
    'AR-VN029': '677ab19727b78ac01f4ba636',
    'CA-VN029': '677ab30327b78ac01f4bbd37',
    'CO-VN029': '677ab31727b78ac01f4bbd6c',
    'CT-VN029': '677ab33127b78ac01f4bbdb5',
    'DE-VN029': '677ab35927b78ac01f4bc05c',
    'DC-VN029': '677ab36e27b78ac01f4bc1ce',
    'FL-VN029': '677ab38727b78ac01f4bc35a',
    'GA-VN029': '677ab39a27b78ac01f4bc49c',
    'HI-VN029': '677ab3ec27b78ac01f4bc5db',
    'ID-VN029': '677ab41c27b78ac01f4bc80d',
    'IL-VN029': '677ab42c27b78ac01f4bc936',
    'IN-VN029': '677ab43f27b78ac01f4bca84',
    'IA-VN029': '677ab45427b78ac01f4bcbcf',
    'KS-VN029': '677ab46727b78ac01f4bcd05',
    'KY-VN029': '677ab47727b78ac01f4bce0c',
    'LA-VN029': '677ab48b27b78ac01f4bcfc3',
    'ME-VN029': '677ab49b27b78ac01f4bd0c2',
    'MD-VN029': '677ab4b127b78ac01f4bd221',
    'MA-VN029': '677ab4c627b78ac01f4bd35d',
    'MI-VN029': '677ab4da27b78ac01f4bd4a0',
    'MN-VN029': '677ab4e927b78ac01f4bd59a',
    'MS-VN029': '677ab50b27b78ac01f4bd79c',
    'MO-VN029': '677ab51f27b78ac01f4bd8cd',
    'MT-VN029': '677ab53e27b78ac01f4bda8d',
    'NE-VN029': '677ab57727b78ac01f4bdef4',
    'NV-VN029': '677ab5a127b78ac01f4be170',
    'NH-VN029': '677ab5b627b78ac01f4be330',
    'NJ-VN029': '677ab6e627b78ac01f4bef52',
    'NM-VN029': '677ab7eb27b78ac01f4bffc1',
    'NY-VN029': '677ab80b27b78ac01f4c0141',
    'NC-VN029': '677ab81827b78ac01f4c015a',
    'ND-VN029': '677ab82c27b78ac01f4c016e',
    'OH-VN029': '677ab88127b78ac01f4c02d9',
    'OK-VN029': '677ab8cb27b78ac01f4c05b5',
    'OR-VN029': '677ab8d927b78ac01f4c0693',
    'PA-VN029': '677ab91427b78ac01f4c0a18',
    'RI-VN029': '677ab92427b78ac01f4c0b16',
    'SC-VN029': '677ab92f27b78ac01f4c0c39',
    'SD-VN029': '677ab96127b78ac01f4c0f9f',
    'TN-VN029': '677ab97027b78ac01f4c1094',
    'TX-VN029': '677ab97b27b78ac01f4c113d',
    'UT-VN029': '677abb5d27b78ac01f4c269c',
    'VT-VN029': '677abb7227b78ac01f4c2808',
    'VA-VN029': '677abb8027b78ac01f4c2908',
    'WA-VN029': '677abc1627b78ac01f4c3298',
    'WV-VN029': '677abc2327b78ac01f4c3357',
    'WI-VN029': '677abc3727b78ac01f4c3496',
    'WY-VN029': '677abc4727b78ac01f4c3587',
    'AL-NCL07': '677ab0a727b78ac01f4b9a0f',
    'FL-NCL07': '677abe5627b78ac01f4c51fb',
    'GA-NCL07': '677abe8727b78ac01f4c5590',
    'NC-NCL07': '67847e9f477432a7c853f1f5',
    'PA-NCL07': '67847eb7477432a7c853f203',
    'TX-NCL07': '67847eca477432a7c853f446',
    'AL-VET06': '67770d61e345699491e695ca',
    'AK-VET06': '67770de8e345699491e69ce2',
    'AZ-VET06': '67770dfde345699491e69d98',
    'AR-VET06': '67770e13e345699491e69e66',
    'CA-VET06': '67770e71e345699491e6a727',
    'CO-VET06': '67770f14e345699491e6b502',
    'CT-VET06': '67770f49e345699491e6ba73',
    'DE-VET06': '67771027e345699491e6cc2a',
    'DC-VET06': '6777103be345699491e6ce05',
    'FL-VET06': '6777104ee345699491e6d012',
    'GA-VET06': '67771062e345699491e6d1bb',
    'HI-VET06': '67771076e345699491e6d3d3',
    'ID-VET06': '67771090e345699491e6d5fc',
    'IL-VET06': '677710a8e345699491e6d8bf',
    'IN-VET06': '677710c5e345699491e6dc6f',
    'IA-VET06': '677711ace345699491e6ee5c',
    'KS-VET06': '677711cae345699491e6f00b',
    'KY-VET06': '67771231e345699491e6f553',
    'LA-VET06': '67771246e345699491e6f723',
    'ME-VET06': '67771265e345699491e6fa37',
    'MD-VET06': '67771276e345699491e6fb9b',
    'MA-VET06': '67771296e345699491e6fea5',
    'MI-VET06': '677712aee345699491e700ae',
    'MN-VET06': '677712bfe345699491e70224',
    'MS-VET06': '677712d0e345699491e703b7',
    'MO-VET06': '677712e1e345699491e70544',
    'MT-VET06': '677712f4e345699491e70703',
    'NE-VET06': '67771325e345699491e70bb2',
    'NV-VET06': '67771336e345699491e70d86',
    'NH-VET06': '67771348e345699491e70f5f',
    'NJ-VET06': '6777135ae345699491e71133',
    'NM-VET06': '67771472e345699491e7241a',
    'NY-VET06': '67771487e345699491e725e7',
    'NC-VET06': '677714c6e345699491e72bc6',
    'ND-VET06': '67771505e345699491e732b9',
    'OH-VET06': '67771515e345699491e73442',
    'OK-VET06': '67771527e345699491e73757',
    'OR-VET06': '67771534e345699491e738aa',
    'PA-VET06': '6777154ee345699491e73b48',
    'RI-VET06': '67771587e345699491e74080',
    'SC-VET06': '677715a4e345699491e7435e',
    'SD-VET06': '677715b5e345699491e744fe',
    'TN-VET06': '677715d7e345699491e747c6',
    'TX-VET06': '677715ede345699491e74897',
    'UT-VET06': '677715fde345699491e74921',
    'VT-VET06': '6777160de345699491e749d8',
    'VA-VET06': '67771621e345699491e74ba1',
    'WA-VET06': '67771634e345699491e74d90',
    'WV-VET06': '67771646e345699491e7545f',
    'WI-VET06': '67771657e345699491e75b16',
    'WY-VET06': '6777166ae345699491e75ca4',
    'AL-GLOBE': '67981eb12b9e2ee73d91b069',
    'AK-GLOBE': '67981eb12b9e2ee73d91b069',
    'AZ-GLOBE': '67981eb12b9e2ee73d91b069',
    'AR-GLOBE': '67981eb12b9e2ee73d91b069',
    'CA-GLOBE': '67981eb12b9e2ee73d91b069',
    'CO-GLOBE': '67981eb12b9e2ee73d91b069',
    'CT-GLOBE': '67981eb12b9e2ee73d91b069',
    'DE-GLOBE': '67981eb12b9e2ee73d91b069',
    'DC-GLOBE': '67981eb12b9e2ee73d91b069',
    'FL-GLOBE': '67981eb12b9e2ee73d91b069',
    'GA-GLOBE': '67981eb12b9e2ee73d91b069',
    'HI-GLOBE': '67981eb12b9e2ee73d91b069',
    'ID-GLOBE': '67981eb12b9e2ee73d91b069',
    'IL-GLOBE': '67981eb12b9e2ee73d91b069',
    'IN-GLOBE': '67981eb12b9e2ee73d91b069',
    'IA-GLOBE': '67981eb12b9e2ee73d91b069',
    'KS-GLOBE': '67981eb12b9e2ee73d91b069',
    'KY-GLOBE': '67981eb12b9e2ee73d91b069',
    'LA-GLOBE': '67981eb12b9e2ee73d91b069',
    'ME-GLOBE': '67981eb12b9e2ee73d91b069',
    'MD-GLOBE': '67981eb12b9e2ee73d91b069',
    'MA-GLOBE': '67981eb12b9e2ee73d91b069',
    'MI-GLOBE': '67981eb12b9e2ee73d91b069',
    'MN-GLOBE': '67981eb12b9e2ee73d91b069',
    'MS-GLOBE': '67981eb12b9e2ee73d91b069',
    'MO-GLOBE': '67981eb12b9e2ee73d91b069',
    'MT-GLOBE': '67981eb12b9e2ee73d91b069',
    'NE-GLOBE': '67981eb12b9e2ee73d91b069',
    'NV-GLOBE': '67981eb12b9e2ee73d91b069',
    'NH-GLOBE': '67981eb12b9e2ee73d91b069',
    'NJ-GLOBE': '67981eb12b9e2ee73d91b069',
    'NM-GLOBE': '67981eb12b9e2ee73d91b069',
    'NY-GLOBE': '67981eb12b9e2ee73d91b069',
    'NC-GLOBE': '67981eb12b9e2ee73d91b069',
    'ND-GLOBE': '67981eb12b9e2ee73d91b069',
    'OH-GLOBE': '67981eb12b9e2ee73d91b069',
    'OK-GLOBE': '67981eb12b9e2ee73d91b069',
    'OR-GLOBE': '67981eb12b9e2ee73d91b069',
    'PA-GLOBE': '67981eb12b9e2ee73d91b069',
    'RI-GLOBE': '67981eb12b9e2ee73d91b069',
    'SC-GLOBE': '67981eb12b9e2ee73d91b069',
    'SD-GLOBE': '67981eb12b9e2ee73d91b069',
    'TN-GLOBE': '67981eb12b9e2ee73d91b069',
    'TX-GLOBE': '67981eb12b9e2ee73d91b069',
    'UT-GLOBE': '67981eb12b9e2ee73d91b069',
    'VT-GLOBE': '67981eb12b9e2ee73d91b069',
    'VA-GLOBE': '67981eb12b9e2ee73d91b069',
    'WA-GLOBE': '67981eb12b9e2ee73d91b069',
    'WV-GLOBE': '67981eb12b9e2ee73d91b069',
    'WI-GLOBE': '67981eb12b9e2ee73d91b069',
    'WY-GLOBE': '67981eb12b9e2ee73d91b069',
    'AL-VN071': '677ab08027b78ac01f4b99dc',
    'AK-VN071': '677ab16c27b78ac01f4ba371',
    'AZ-VN071': '677ab18327b78ac01f4ba4e7',
    'AR-VN071': '677ab19727b78ac01f4ba636',
    'CA-VN071': '677ab30327b78ac01f4bbd37',
    'CO-VN071': '677ab31727b78ac01f4bbd6c',
    'CT-VN071': '677ab33127b78ac01f4bbdb5',
    'DE-VN071': '677ab35927b78ac01f4bc05c',
    'DC-VN071': '677ab36e27b78ac01f4bc1ce',
    'FL-VN071': '677ab38727b78ac01f4bc35a',
    'GA-VN071': '677ab39a27b78ac01f4bc49c',
    'HI-VN071': '677ab3ec27b78ac01f4bc5db',
    'ID-VN071': '677ab41c27b78ac01f4bc80d',
    'IL-VN071': '677ab42c27b78ac01f4bc936',
    'IN-VN071': '677ab43f27b78ac01f4bca84',
    'IA-VN071': '677ab45427b78ac01f4bcbcf',
    'KS-VN071': '677ab46727b78ac01f4bcd05',
    'KY-VN071': '677ab47727b78ac01f4bce0c',
    'LA-VN071': '677ab48b27b78ac01f4bcfc3',
    'ME-VN071': '677ab49b27b78ac01f4bd0c2',
    'MD-VN071': '677ab4b127b78ac01f4bd221',
    'MA-VN071': '677ab4c627b78ac01f4bd35d',
    'MI-VN071': '677ab4da27b78ac01f4bd4a0',
    'MN-VN071': '677ab4e927b78ac01f4bd59a',
    'MS-VN071': '677ab50b27b78ac01f4bd79c',
    'MO-VN071': '677ab51f27b78ac01f4bd8cd',
    'MT-VN071': '677ab53e27b78ac01f4bda8d',
    'NE-VN071': '677ab57727b78ac01f4bdef4',
    'NV-VN071': '677ab5a127b78ac01f4be170',
    'NH-VN071': '677ab5b627b78ac01f4be330',
    'NJ-VN071': '677ab6e627b78ac01f4bef52',
    'NM-VN071': '677ab7eb27b78ac01f4bffc1',
    'NY-VN071': '677ab80b27b78ac01f4c0141',
    'NC-VN071': '677ab81827b78ac01f4c015a',
    'ND-VN071': '677ab82c27b78ac01f4c016e',
    'OH-VN071': '677ab88127b78ac01f4c02d9',
    'OK-VN071': '677ab8cb27b78ac01f4c05b5',
    'OR-VN071': '677ab8d927b78ac01f4c0693',
    'PA-VN071': '677ab91427b78ac01f4c0a18',
    'RI-VN071': '677ab92427b78ac01f4c0b16',
    'SC-VN071': '677ab92f27b78ac01f4c0c39',
    'SD-VN071': '677ab96127b78ac01f4c0f9f',
    'TN-VN071': '677ab97027b78ac01f4c1094',
    'TX-VN071': '677ab97b27b78ac01f4c113d',
    'UT-VN071': '677abb5d27b78ac01f4c269c',
    'VT-VN071': '677abb7227b78ac01f4c2808',
    'VA-VN071': '677abb8027b78ac01f4c2908',
    'WA-VN071': '677abc1627b78ac01f4c3298',
    'WV-VN071': '677abc2327b78ac01f4c3357',
    'WI-VN071': '677abc3727b78ac01f4c3496',
    'WY-VN071': '677abc4727b78ac01f4c3587',
    'AL-VN029': '677ab08027b78ac01f4b99dc',
    'AK-VN029': '677ab16c27b78ac01f4ba371',
    'AZ-VN029': '677ab18327b78ac01f4ba4e7',
    'AR-VN029': '677ab19727b78ac01f4ba636',
    'CA-VN029': '677ab30327b78ac01f4bbd37',
    'CO-VN029': '677ab31727b78ac01f4bbd6c',
    'CT-VN029': '677ab33127b78ac01f4bbdb5',
    'DE-VN029': '677ab35927b78ac01f4bc05c',
    'DC-VN029': '677ab36e27b78ac01f4bc1ce',
    'FL-VN029': '677ab38727b78ac01f4bc35a',
    'GA-VN029': '677ab39a27b78ac01f4bc49c',
    'HI-VN029': '677ab3ec27b78ac01f4bc5db',
    'ID-VN029': '677ab41c27b78ac01f4bc80d',
    'IL-VN029': '677ab42c27b78ac01f4bc936',
    'IN-VN029': '677ab43f27b78ac01f4bca84',
    'IA-VN029': '677ab45427b78ac01f4bcbcf',
    'KS-VN029': '677ab46727b78ac01f4bcd05',
    'KY-VN029': '677ab47727b78ac01f4bce0c',
    'LA-VN029': '677ab48b27b78ac01f4bcfc3',
    'ME-VN029': '677ab49b27b78ac01f4bd0c2',
    'MD-VN029': '677ab4b127b78ac01f4bd221',
    'MA-VN029': '677ab4c627b78ac01f4bd35d',
    'MI-VN029': '677ab4da27b78ac01f4bd4a0',
    'MN-VN029': '677ab4e927b78ac01f4bd59a',
    'MS-VN029': '677ab50b27b78ac01f4bd79c',
    'MO-VN029': '677ab51f27b78ac01f4bd8cd',
    'MT-VN029': '677ab53e27b78ac01f4bda8d',
    'NE-VN029': '677ab57727b78ac01f4bdef4',
    'NV-VN029': '677ab5a127b78ac01f4be170',
    'NH-VN029': '677ab5b627b78ac01f4be330',
    'NJ-VN029': '677ab6e627b78ac01f4bef52',
    'NM-VN029': '677ab7eb27b78ac01f4bffc1',
    'NY-VN029': '677ab80b27b78ac01f4c0141',
    'NC-VN029': '677ab81827b78ac01f4c015a',
    'ND-VN029': '677ab82c27b78ac01f4c016e',
    'OH-VN029': '677ab88127b78ac01f4c02d9',
    'OK-VN029': '677ab8cb27b78ac01f4c05b5',
    'OR-VN029': '677ab8d927b78ac01f4c0693',
    'PA-VN029': '677ab91427b78ac01f4c0a18',
    'RI-VN029': '677ab92427b78ac01f4c0b16',
    'SC-VN029': '677ab92f27b78ac01f4c0c39',
    'SD-VN029': '677ab96127b78ac01f4c0f9f',
    'TN-VN029': '677ab97027b78ac01f4c1094',
    'TX-VN029': '677ab97b27b78ac01f4c113d',
    'UT-VN029': '677abb5d27b78ac01f4c269c',
    'VT-VN029': '677abb7227b78ac01f4c2808',
    'VA-VN029': '677abb8027b78ac01f4c2908',
    'WA-VN029': '677abc1627b78ac01f4c3298',
    'WV-VN029': '677abc2327b78ac01f4c3357',
    'WI-VN029': '677abc3727b78ac01f4c3496',
    'WY-VN029': '677abc4727b78ac01f4c3587',
    'AL-NCL07': '677ab0a727b78ac01f4b9a0f',
    'AK-NCL07': '677abd4727b78ac01f4c40e8',
    'AZ-NCL07': '677abd5527b78ac01f4c4108',
    'AR-NCL07': '677abde327b78ac01f4c4ac4',
    'CA-NCL07': '677abdf327b78ac01f4c4bba',
    'CO-NCL07': '677abe0127b78ac01f4c4cb8',
    'CT-NCL07': '677abe0c27b78ac01f4c4d77',
    'DE-NCL07': '677abe3827b78ac01f4c5025',
    'DC-NCL07': '677abe4527b78ac01f4c50f4',
    'FL-NCL07': '677abe5627b78ac01f4c51fb',
    'GA-NCL07': '677abe8727b78ac01f4c5590',
    'HI-NCL07': '677abe9427b78ac01f4c568b',
    'ID-NCL07': '677abead27b78ac01f4c5858',
    'IL-NCL07': '677abef027b78ac01f4c5dc4',
    'IN-NCL07': '677abf3b27b78ac01f4c6240',
    'IA-NCL07': '677abfad27b78ac01f4c63a9',
    'KS-NCL07': '677abfcd27b78ac01f4c65be',
    'KY-NCL07': '677abfe427b78ac01f4c6736',
    'LA-NCL07': '677ac01427b78ac01f4c6a6d',
    'ME-NCL07': '677ac03427b78ac01f4c6c9f',
    'MD-NCL07': '677ac07e27b78ac01f4c71ec',
    'MA-NCL07': '677ac0c127b78ac01f4c769f',
    'MI-NCL07': '677ac0ce27b78ac01f4c7798',
    'MN-NCL07': '677ac0da27b78ac01f4c7857',
    'MS-NCL07': '677ac10d27b78ac01f4c7bac',
    'MO-NCL07': '677ac11a27b78ac01f4c7c47',
    'MT-NCL07': '677ac13327b78ac01f4c7c59',
    'NE-NCL07': '677ac14427b78ac01f4c7c70',
    'NV-NCL07': '677ac15027b78ac01f4c7c89',
    'NH-NCL07': '677ac18027b78ac01f4c7d8e',
    'NJ-NCL07': '677ac18b27b78ac01f4c7db3',
    'NM-NCL07': '677ac19727b78ac01f4c7de2',
    'NY-NCL07': '677ac1a827b78ac01f4c7ef2',
    'NC-NCL07': '677ac1b427b78ac01f4c7fc0',
    'ND-NCL07': '677ac1bf27b78ac01f4c8080',
    'OH-NCL07': '677ac1f827b78ac01f4c826a',
    'OK-NCL07': '677ac20627b78ac01f4c8290',
    'OR-NCL07': '677ac21127b78ac01f4c8345',
    'PA-NCL07': '677ac21f27b78ac01f4c843e',
    'RI-NCL07': '677ac24127b78ac01f4c8633',
    'SC-NCL07': '677ac24f27b78ac01f4c870c',
    'SD-NCL07': '677ac25a27b78ac01f4c87ba',
    'TN-NCL07': '677ac26527b78ac01f4c8872',
    'TX-NCL07': '677ac27227b78ac01f4c8941',
    'UT-NCL07': '677ac27d27b78ac01f4c8a00',
    'VT-NCL07': '677ac29027b78ac01f4c8b3d',
    'VA-NCL07': '677ac29d27b78ac01f4c8c56',
    'WA-NCL07': '677ac2b227b78ac01f4c8daa',
    'WV-NCL07': '677ac2c027b78ac01f4c8e88',
    'WI-NCL07': '677ac2ce27b78ac01f4c8f50',
    'WY-NCL07': '677ac2da27b78ac01f4c9011',
    'AL-NCL04': '677ab0a727b78ac01f4b9a0f',
    'AK-NCL04': '677abd4727b78ac01f4c40e8',
    'AZ-NCL04': '677abd5527b78ac01f4c4108',
    'AR-NCL04': '677abde327b78ac01f4c4ac4',
    'CA-NCL04': '677abdf327b78ac01f4c4bba',
    'CO-NCL04': '677abe0127b78ac01f4c4cb8',
    'CT-NCL04': '677abe0c27b78ac01f4c4d77',
    'DE-NCL04': '677abe3827b78ac01f4c5025',
    'DC-NCL04': '677abe4527b78ac01f4c50f4',
    'FL-NCL04': '677abe5627b78ac01f4c51fb',
    'GA-NCL04': '677abe8727b78ac01f4c5590',
    'HI-NCL04': '677abe9427b78ac01f4c568b',
    'ID-NCL04': '677abead27b78ac01f4c5858',
    'IL-NCL04': '677abef027b78ac01f4c5dc4',
    'IN-NCL04': '677abf3b27b78ac01f4c6240',
    'IA-NCL04': '677abfad27b78ac01f4c63a9',
    'KS-NCL04': '677abfcd27b78ac01f4c65be',
    'KY-NCL04': '677abfe427b78ac01f4c6736',
    'LA-NCL04': '677ac01427b78ac01f4c6a6d',
    'ME-NCL04': '677ac03427b78ac01f4c6c9f',
    'MD-NCL04': '677ac07e27b78ac01f4c71ec',
    'MA-NCL04': '677ac0c127b78ac01f4c769f',
    'MI-NCL04': '677ac0ce27b78ac01f4c7798',
    'MN-NCL04': '677ac0da27b78ac01f4c7857',
    'MS-NCL04': '677ac10d27b78ac01f4c7bac',
    'MO-NCL04': '677ac11a27b78ac01f4c7c47',
    'MT-NCL04': '677ac13327b78ac01f4c7c59',
    'NE-NCL04': '677ac14427b78ac01f4c7c70',
    'NV-NCL04': '677ac15027b78ac01f4c7c89',
    'NH-NCL04': '677ac18027b78ac01f4c7d8e',
    'NJ-NCL04': '677ac18b27b78ac01f4c7db3',
    'NM-NCL04': '677ac19727b78ac01f4c7de2',
    'NY-NCL04': '677ac1a827b78ac01f4c7ef2',
    'NC-NCL04': '677ac1b427b78ac01f4c7fc0',
    'ND-NCL04': '677ac1bf27b78ac01f4c8080',
    'OH-NCL04': '677ac1f827b78ac01f4c826a',
    'OK-NCL04': '677ac20627b78ac01f4c8290',
    'OR-NCL04': '677ac21127b78ac01f4c8345',
    'PA-NCL04': '677ac21f27b78ac01f4c843e',
    'RI-NCL04': '677ac24127b78ac01f4c8633',
    'SC-NCL04': '677ac24f27b78ac01f4c870c',
    'SD-NCL04': '677ac25a27b78ac01f4c87ba',
    'TN-NCL04': '677ac26527b78ac01f4c8872',
    'TX-NCL04': '677ac27227b78ac01f4c8941',
    'UT-NCL04': '677ac27d27b78ac01f4c8a00',
    'VT-NCL04': '677ac29027b78ac01f4c8b3d',
    'VA-NCL04': '677ac29d27b78ac01f4c8c56',
    'WA-NCL04': '677ac2b227b78ac01f4c8daa',
    'WV-NCL04': '677ac2c027b78ac01f4c8e88',
    'WI-NCL04': '677ac2ce27b78ac01f4c8f50',
    'WY-NCL04': '677ac2da27b78ac01f4c9011',
};

// Function to get campaign ID from MatchKey
function getCampaignId(matchKey) {
    return CAMPAIGN_MAPPING[matchKey] || '';
}

// Function to read leads from CSV files
async function getLeadsFromCSV() {
    try {
        console.log('Reading leads from exports CSV files...');
        
        const files = fs.readdirSync(EXPORTS_DIR)
            .filter(file => file.endsWith('.csv'))
            .map(file => path.join(EXPORTS_DIR, file));

        const leads = [];

        for (const file of files) {
            console.log(`Processing file: ${file}`);
            
            await new Promise((resolve, reject) => {
                fs.createReadStream(file)
                    .pipe(csv())
                    .on('data', (row) => {
                        leads.push(row);
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });
        }

        console.log(`Found ${leads.length} leads`);
        return leads;
    } catch (error) {
        console.error('Error reading CSV files:', error);
        throw error;
    }
}

// Function to load campaign mappings
function loadCampaignMappings() {
    try {
        const campaignData = fs.readFileSync(CAMPAIGN_LIST_FILE, 'utf8');
        const campaigns = parse(campaignData, { columns: true });
        
        // Create mapping of MatchKey to CampaignID
        const mappings = {};
        campaigns.forEach(campaign => {
            if (campaign.MatchKey && campaign.CampaignID) {
                mappings[campaign.MatchKey] = campaign.CampaignID;
            }
        });
        return mappings;
    } catch (error) {
        console.error('Error loading campaign mappings:', error);
        return {};
    }
}

// Add campaign IDs to leads
function addCampaignIDs(leads, campaignMappings) {
    return leads.map(lead => {
        const matchKey = lead.MatchKey;
        if (matchKey && campaignMappings[matchKey]) {
            lead.CampaignID = campaignMappings[matchKey];
        } else {
            console.log(`No campaign ID found for MatchKey: ${matchKey}`);
        }
        return lead;
    });
}

// Main export function
async function exportLeads() {
    try {
        console.log('Starting lead export process...');
        
        // Get leads from CSV files
        const leads = await getLeadsFromCSV();
        
        if (leads.length === 0) {
            console.log('No leads to export');
            return;
        }

        // Generate export filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(PROCESSED_DIR, `airtable_export_${timestamp}.csv`);
        
        console.log('Processing leads...');

        // Get all fields
        const fields = Array.from(new Set(leads.flatMap(lead => Object.keys(lead))));
        fields.push('CampaignID'); // Add CampaignID field
        
        // Create CSV content
        const csvRows = leads.map(lead => {
            const row = fields.map(field => {
                if (field === 'CampaignID') {
                    const campaignId = getCampaignId(lead.MatchKey);
                    if (!campaignId) {
                        console.warn(`No campaign ID found for MatchKey: ${lead.MatchKey}`);
                    }
                    return `"${campaignId}"`;
                }
                
                const value = lead[field] || '';
                return `"${value.toString().replace(/"/g, '""')}"`;
            }).join(',');

            return row;
        });

        // Write to file
        const csvContent = [fields.join(','), ...csvRows].join('\n');
        fs.writeFileSync(filename, csvContent, 'utf8');
        
        console.log(`Export complete!`);
        console.log(`- Total leads: ${leads.length}`);
        console.log(`- File location: ${filename}`);

    } catch (error) {
        console.error('Error during export:', error);
        throw error;
    }
}

async function processLeads() {
    console.log('Starting lead processing...');
    
    try {
        // Get all CSV files from exports directory
        const files = fs.readdirSync(EXPORTS_DIR)
            .filter(file => file.startsWith('airtable_export_') && file.endsWith('.csv'));
        
        console.log(`Found ${files.length} files to process in exports/`);
        
        for (const file of files) {
            const filepath = path.join(EXPORTS_DIR, file);
            console.log(`Processing ${file}...`);
            
            try {
                // Process the file
                await exportLeads(filepath);
                
                // Delete after successful processing
                fs.unlinkSync(filepath);
                console.log(`Processed and deleted ${file}`);
            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
        
        return `Processed ${files.length} lead files`;
    } catch (error) {
        console.error('Error in processLeads:', error);
        throw error;
    }
}

async function sendToZoho(lead) {
    const accessToken = await getAccessToken();
    // Use accessToken in your Zoho API calls
}

module.exports = {
    processLeads,
    exportLeads
};

// If running directly
if (require.main === module) {
    console.log('Starting export process...');
    exportLeads().then(() => {
        console.log('Process finished');
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
