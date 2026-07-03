#!/usr/bin/env node

// Parse INSERT data with company_email column
const insertData = `
('29240', '200388', 'END', '18594170', NULL, '+14235721339', 'Carol', 'Powers', 'Veteran', '', NULL, NULL, '2025-11-04 19:38:36.191+00'),
('29239', '200388', 'END', '18594170', NULL, '+14235721339', 'Carol', 'Powers', 'Veteran', '44.716', NULL, NULL, '2025-11-04 19:38:35.447+00'),
('29236', '145691', 'END', '18652733', NULL, '+15712177711', 'Peter', 'Tanner', 'Veteran', '', NULL, NULL, '2025-11-04 19:25:55.701+00'),
('29235', '145691', 'END', '18652733', NULL, '+15712177711', 'Peter', 'Tanner', 'Veteran', '772.821', NULL, NULL, '2025-11-04 19:25:54.928+00'),
('29227', '197816', 'END', '18639706', 'carleynicholson@aoglobelife.com', '+15743275922', 'Nicholas', 'Malec', 'Veteran', '415.782', NULL, NULL, '2025-11-04 19:02:36.018+00'),
('28910', '131252', 'END', '18651658', 'patriciasantamarina@aoglobelife.com', '+19788864966', 'Deborah', 'Chisholm', 'Veteran', '29.547', NULL, NULL, '2025-11-04 17:56:46.672+00'),
('29228', '63603', 'END', '18640703', 'melissaowens@aoglobelife.com', '+13609014671', 'Elizabeth', 'Morris', 'Veteran', '55.134', NULL, NULL, '2025-11-04 19:02:36.019+00'),
('28510', '131252', 'END', '18632086', 'patriciasantamarina@aoglobelife.com', '+13606609293', 'Robert', 'Shavers', 'Veteran', '132.498', NULL, NULL, '2025-11-04 16:55:53.831+00'),
('28511', '131252', 'END', '18632086', 'patriciasantamarina@aoglobelife.com', '+13606609293', 'Robert', 'Shavers', 'Veteran', '', NULL, NULL, '2025-11-04 16:55:53.135+00'),
('28534', '131252', 'END', '18631449', 'patriciasantamarina@aoglobelife.com', '+16025072891', 'Gary', 'Haley', 'Veteran', '401.224', NULL, NULL, '2025-11-04 16:56:32.827+00'),
('28535', '131252', 'END', '18631449', 'patriciasantamarina@aoglobelife.com', '+16025072891', 'Gary', 'Haley', 'Veteran', '', NULL, NULL, '2025-11-04 16:56:32.026+00'),
('28562', '131252', 'END', '18637594', 'patriciasantamarina@aoglobelife.com', '+13089911704', 'Theresa', 'Medina', 'Veteran', '251.054', NULL, NULL, '2025-11-04 17:01:03.853+00'),
('28330', '131252', 'END', '18636687', 'patriciasantamarina@aoglobelife.com', '+18584806859', 'Mary', 'Mitchell', 'Veteran', '754.895', NULL, NULL, '2025-11-04 16:11:26.768+00'),
('29014', '131252', 'END', '18600515', 'patriciasantamarina@aoglobelife.com', '+19064935144', 'Nancy', 'Mielke', 'Veteran', '666.084', NULL, NULL, '2025-11-04 18:04:13.833+00'),
('29224', '145691', 'END', '18653488', NULL, '+12767010210', 'Carl', 'Swartz', 'Veteran', '', NULL, NULL, '2025-11-04 18:59:35.767+00'),
('29223', '145691', 'END', '18653488', NULL, '+12767010210', 'Carl', 'Swartz', 'Veteran', '158.646', NULL, NULL, '2025-11-04 18:59:35.608+00'),
('29213', '213793', 'END', '18651285', 'thomasgrant@aoglobelife.com', '+17036062102', 'Tyrone', 'Davis', 'Veteran', '60.322', NULL, NULL, '2025-11-04 18:52:08.682+00'),
('29210', '213793', 'END', '18651262', 'thomasgrant@aoglobelife.com', '+15409866783', 'Louis', 'Smith', 'Veteran', '', NULL, NULL, '2025-11-04 18:49:39.647+00'),
('29209', '213793', 'END', '18651262', 'thomasgrant@aoglobelife.com', '+15409866783', 'Louis', 'Smith', 'Veteran', '50.432', NULL, NULL, '2025-11-04 18:49:38.594+00'),
('29200', '157337', 'END', '18652867', 'dianarendon@aoglobelife.com', '+19725225857', 'Patricia', 'Scott', 'Veteran', '289.134', NULL, NULL, '2025-11-04 18:43:57.762+00'),
('29195', '210284', 'END', '18651523', 'amandaolivares@aoglobelife.com', '+17706379849', 'Audrey', 'Washington', 'Veteran', '173.997', NULL, NULL, '2025-11-04 18:40:28.831+00'),
('29192', '197159', 'END', '18641864', 'anitaruiz@aoglobelife.com', '+13603913831', 'Deborah', 'Morgan', 'Veteran', '50.872', NULL, NULL, '2025-11-04 18:38:58.801+00'),
('29177', '174433', 'END', '18589642', 'cindygallegos@aoglobelife.com', '+17204669502', 'Sheri', 'Robinson', 'Veteran', '46.281', NULL, NULL, '2025-11-04 18:27:28.783+00'),
('29176', '134400', 'END', '18641420', 'oliverjones@aoglobelife.com', '+13604652267', 'Loretta', 'Lyle', 'Veteran', '97.348', NULL, NULL, '2025-11-04 18:27:28.783+00'),
('29165', '196676', 'END', '18596533', 'carleyburgess@aoglobelife.com', '+12547618088', 'Nicholas', 'Smith', 'Veteran', '239.932', NULL, NULL, '2025-11-04 18:21:28.766+00'),
('29164', '196676', 'END', '18596533', 'carleyburgess@aoglobelife.com', '+12547618088', 'Nicholas', 'Smith', 'Veteran', '', NULL, NULL, '2025-11-04 18:21:27.97+00'),
('29151', '95059', 'END', '18607430', 'richiealtig@aoglobelife.com', '+19034859903', 'William', 'Compton', 'Veteran', '274.948', NULL, NULL, '2025-11-04 18:17:28.806+00'),
('29150', '95059', 'END', '18607430', 'richiealtig@aoglobelife.com', '+19034859903', 'William', 'Compton', 'Veteran', '', NULL, NULL, '2025-11-04 18:17:27.943+00'),
('29148', '174433', 'END', '18654281', 'cindygallegos@aoglobelife.com', '+17192605802', 'Ronald', 'Roux', 'Veteran', '117.134', NULL, NULL, '2025-11-04 18:15:28.79+00'),
('29137', '145691', 'END', '18610330', NULL, '+19193627808', 'Roy', 'Tillery', 'Veteran', '64.498', NULL, NULL, '2025-11-04 18:09:36.848+00'),
('29134', '174701', 'END', '18591691', 'susannahart@aoglobelife.com', '+17732779370', 'Joyce', 'Bolden', 'Veteran', '159.531', NULL, NULL, '2025-11-04 18:05:28.827+00'),
('29133', '174701', 'END', '18591691', 'susannahart@aoglobelife.com', '+17732779370', 'Joyce', 'Bolden', 'Veteran', '', NULL, NULL, '2025-11-04 18:05:28.196+00'),
('29132', '131250', 'END', '18628681', 'biyancadeanda@aoglobelife.com', '+19164813028', 'Patrice', 'Lewis', 'Veteran', '151.281', NULL, NULL, '2025-11-04 18:05:28.796+00'),
('29125', '95059', 'END', '18587448', 'richiealtig@aoglobelife.com', '+14798026686', 'Norman', 'Lisle', 'Veteran', '194.632', NULL, NULL, '2025-11-04 18:01:28.795+00'),
('29124', '95059', 'END', '18587448', 'richiealtig@aoglobelife.com', '+14798026686', 'Norman', 'Lisle', 'Veteran', '', NULL, NULL, '2025-11-04 18:01:28.053+00'),
('29123', '174701', 'END', '18548397', 'susannahart@aoglobelife.com', '+17087226628', 'Nathaniel', 'Williams', 'Veteran', '94.497', NULL, NULL, '2025-11-04 17:59:28.811+00'),
('29122', '174701', 'END', '18548397', 'susannahart@aoglobelife.com', '+17087226628', 'Nathaniel', 'Williams', 'Veteran', '', NULL, NULL, '2025-11-04 17:59:27.9+00'),
('29115', '95059', 'END', '18630136', 'richiealtig@aoglobelife.com', '+18172448959', 'Shirley', 'Sullivan', 'Veteran', '145.365', NULL, NULL, '2025-11-04 17:57:28.849+00'),
('29114', '95059', 'END', '18630136', 'richiealtig@aoglobelife.com', '+18172448959', 'Shirley', 'Sullivan', 'Veteran', '', NULL, NULL, '2025-11-04 17:57:28.039+00'),
('29107', '95059', 'END', '18610235', 'richiealtig@aoglobelife.com', '+19728751330', 'William', 'Perez', 'Veteran', '80.231', NULL, NULL, '2025-11-04 17:53:28.863+00'),
('29106', '95059', 'END', '18610235', 'richiealtig@aoglobelife.com', '+19728751330', 'William', 'Perez', 'Veteran', '', NULL, NULL, '2025-11-04 17:53:28.042+00'),
('29090', '200388', 'END', '18608529', NULL, '+18174797988', 'Jimmy', 'Willis', 'Veteran', '239.332', NULL, NULL, '2025-11-04 17:43:28.877+00'),
('29089', '200388', 'END', '18608529', NULL, '+18174797988', 'Jimmy', 'Willis', 'Veteran', '', NULL, NULL, '2025-11-04 17:43:28.067+00'),
('29084', '185556', 'END', '18654072', 'oliviavargas@aoglobelife.com', '+15705796405', 'Laurel', 'Burke', 'Veteran', '125.897', NULL, NULL, '2025-11-04 17:41:28.897+00'),
('29077', '203499', 'END', '18632604', 'cindysheppard@aoglobelife.com', '+19567722768', 'Michael', 'Arriaga', 'Veteran', '156.198', NULL, NULL, '2025-11-04 17:35:28.877+00'),
('29072', '219298', 'END', '18605430', 'dianamckenzie@aoglobelife.com', '+15039409092', 'Norma', 'Weaver', 'Veteran', '65.731', NULL, NULL, '2025-11-04 17:33:28.913+00'),
('29069', '174701', 'END', '18607477', 'susannahart@aoglobelife.com', '+16305088077', 'Ruth', 'Duncan', 'Veteran', '54.831', NULL, NULL, '2025-11-04 17:31:28.913+00'),
('29068', '174701', 'END', '18607477', 'susannahart@aoglobelife.com', '+16305088077', 'Ruth', 'Duncan', 'Veteran', '', NULL, NULL, '2025-11-04 17:31:28.081+00'),
('29067', '207058', 'END', '18629242', 'alyssarussell@aoglobelife.com', '+14254148030', 'Jerry', 'Williams', 'Veteran', '139.898', NULL, NULL, '2025-11-04 17:31:28.906+00'),
('29066', '194978', 'END', '18651411', 'dorothycartwright@aoglobelife.com', '+13522780770', 'Sarah', 'Yeldell', 'Veteran', '84.197', NULL, NULL, '2025-11-04 17:31:28.913+00'),
('29065', '219298', 'END', '18611681', 'dianamckenzie@aoglobelife.com', '+13604634632', 'Gerald', 'Schultz', 'Veteran', '72.398', NULL, NULL, '2025-11-04 17:29:28.913+00'),
('29062', '134400', 'END', '18650338', 'oliverjones@aoglobelife.com', '+16822317988', 'Vickie', 'Baxter', 'Veteran', '85.697', NULL, NULL, '2025-11-04 17:27:29.93+00'),
('29059', '194978', 'END', '18629270', 'dorothycartwright@aoglobelife.com', '+16058589332', 'Stephanie', 'Ard', 'Veteran', '76.864', NULL, NULL, '2025-11-04 17:25:28.93+00'),
('29048', '134400', 'END', '18649340', 'oliverjones@aoglobelife.com', '+15416902830', 'Elton', 'Compton', 'Veteran', '124.532', NULL, NULL, '2025-11-04 17:19:28.935+00'),
('29047', '207058', 'END', '18653951', 'alyssarussell@aoglobelife.com', '+15032023870', 'Jesus', 'Cordero', 'Veteran', '177.465', NULL, NULL, '2025-11-04 17:19:28.935+00'),
('29029', '200388', 'END', '18610511', NULL, '+14693025622', 'Jose', 'Salinas', 'Veteran', '106.499', NULL, NULL, '2025-11-04 17:11:28.937+00'),
('29028', '200388', 'END', '18610511', NULL, '+14693025622', 'Jose', 'Salinas', 'Veteran', '', NULL, NULL, '2025-11-04 17:11:28.16+00'),
('29023', '219298', 'END', '18630347', 'dianamckenzie@aoglobelife.com', '+13604301119', 'Nancy', 'Farley', 'Veteran', '220.697', NULL, NULL, '2025-11-04 17:09:28.953+00'),
('29016', '200388', 'END', '18564363', NULL, '+19728691073', 'Guadalupe', 'Monroy', 'Veteran', '86.431', NULL, NULL, '2025-11-04 17:07:28.968+00'),
('29015', '200388', 'END', '18564363', NULL, '+19728691073', 'Guadalupe', 'Monroy', 'Veteran', '', NULL, NULL, '2025-11-04 17:07:28.162+00'),
('29004', '194978', 'END', '18569260', 'dorothycartwright@aoglobelife.com', '+13528673172', 'Jean', 'Mack', 'Veteran', '187.765', NULL, NULL, '2025-11-04 17:03:28.968+00'),
('28995', '134400', 'END', '18636903', 'oliverjones@aoglobelife.com', '+15418799833', 'Catherine', 'Decker', 'Veteran', '227.398', NULL, NULL, '2025-11-04 16:59:28.973+00'),
('28990', '194978', 'END', '18641725', 'dorothycartwright@aoglobelife.com', '+15625812103', 'Michael', 'Thomas', 'Veteran', '142.397', NULL, NULL, '2025-11-04 16:57:28.982+00'),
('28977', '204843', 'END', '18653724', 'donnamorales@aoglobelife.com', '+13056671829', 'Sandra', 'Vicks', 'Veteran', '51.731', NULL, NULL, '2025-11-04 16:51:28.997+00'),
('28976', '200388', 'END', '18653560', NULL, '+12488914477', 'Cynthia', 'Hooper', 'Veteran', '204.098', NULL, NULL, '2025-11-04 16:51:28.997+00'),
('28973', '200388', 'END', '18653560', NULL, '+12488914477', 'Cynthia', 'Hooper', 'Veteran', '', NULL, NULL, '2025-11-04 16:51:28.2+00'),
('28958', '200388', 'END', '18653492', NULL, '+12546803832', 'Lilly', 'Gunnells', 'Veteran', '169.865', NULL, NULL, '2025-11-04 16:45:29.014+00'),
('28957', '200388', 'END', '18653492', NULL, '+12546803832', 'Lilly', 'Gunnells', 'Veteran', '', NULL, NULL, '2025-11-04 16:45:28.204+00'),
('28951', '194978', 'END', '18649464', 'dorothycartwright@aoglobelife.com', '+13525082736', 'Lisa', 'Morgan', 'Veteran', '68.198', NULL, NULL, '2025-11-04 16:43:29.029+00'),
('28946', '188631', 'END', '18648834', 'charlotteahrens@aoglobelife.com', '+19062521802', 'Harrold', 'Toole', 'Veteran', '145.965', NULL, NULL, '2025-11-04 16:41:29.029+00'),
('28941', '182687', 'END', '18652117', 'kiaramedrano@aoglobelife.com', '+19544312603', 'Janet', 'Brathwaite', 'Veteran', '50.197', NULL, NULL, '2025-11-04 16:39:29.029+00'),
('28936', '61113', 'END', '18649252', 'esterortiz@aoglobelife.com', '+18312759337', 'Doris', 'Diorio', 'Veteran', '177.598', NULL, NULL, '2025-11-04 16:37:29.034+00'),
('28925', '61113', 'END', '18652062', 'esterortiz@aoglobelife.com', '+19545814205', 'Bessie', 'Reid', 'Veteran', '31.831', NULL, NULL, '2025-11-04 16:31:29.06+00'),
('28924', '134400', 'END', '18651810', 'oliverjones@aoglobelife.com', '+15413174949', 'Tonya', 'Salter', 'Veteran', '82.164', NULL, NULL, '2025-11-04 16:31:29.06+00'),
('28915', '61113', 'END', '18651524', 'esterortiz@aoglobelife.com', '+17868020909', 'Hilda', 'Huebsch', 'Veteran', '50.998', NULL, NULL, '2025-11-04 16:27:29.06+00'),
('28909', '63603', 'END', '18651629', 'melissaowens@aoglobelife.com', '+15418776536', 'Roy', 'Wood', 'Veteran', '166.131', NULL, NULL, '2025-11-04 16:25:29.077+00'),
('28907', '205409', 'END', '18579289', 'deannaparker@aoglobelife.com', '+15033668734', 'Terrance', 'Taylor', 'Veteran', '64.498', NULL, NULL, '2025-11-04 16:25:29.067+00'),
('28892', '205409', 'END', '18649878', 'deannaparker@aoglobelife.com', '+13603204673', 'Jesus', 'Cardenas', 'Veteran', '92.565', NULL, NULL, '2025-11-04 16:19:29.077+00'),
('28891', '134400', 'END', '18649925', 'oliverjones@aoglobelife.com', '+12056371406', 'Mack', 'Thomas', 'Veteran', '126.998', NULL, NULL, '2025-11-04 16:19:29.077+00'),
('28884', '185556', 'END', '18652967', 'oliviavargas@aoglobelife.com', '+15707876733', 'Sally', 'Merritt', 'Veteran', '51.164', NULL, NULL, '2025-11-04 16:17:29.085+00'),
('28875', '185556', 'END', '18610613', 'oliviavargas@aoglobelife.com', '+17174317906', 'Michael', 'Davis', 'Veteran', '152.898', NULL, NULL, '2025-11-04 16:15:29.102+00'),
('28809', '185556', 'END', '18640792', 'oliviavargas@aoglobelife.com', '+17175318103', 'Pamela', 'Henry', 'Veteran', '46.365', NULL, NULL, '2025-11-04 15:53:29.135+00'),
('28422', '167595', 'END', '18633239', 'oliviawalker@aoglobelife.com', '+13602145033', 'Nathaniel', 'Gilliard', 'Veteran', '72.231', NULL, NULL, '2025-11-04 16:28:50.194+00'),
('28421', '167595', 'END', '18633239', 'oliviawalker@aoglobelife.com', '+13602145033', 'Nathaniel', 'Gilliard', 'Veteran', '', NULL, NULL, '2025-11-04 16:28:49.411+00'),
('28785', '187440', 'END', '18636400', 'laurenviloria@aoglobelife.com', '+15208812432', 'Pauline', 'Dillon', 'Veteran', '128.698', NULL, NULL, '2025-11-04 15:47:29.152+00'),
('28784', '187440', 'END', '18636400', 'laurenviloria@aoglobelife.com', '+15208812432', 'Pauline', 'Dillon', 'Veteran', '', NULL, NULL, '2025-11-04 15:47:28.343+00'),
('28779', '187440', 'END', '18598684', 'laurenviloria@aoglobelife.com', '+19282274809', 'Nicholas', 'Hill', 'Veteran', '230.098', NULL, NULL, '2025-11-04 15:45:29.152+00'),
('28776', '409', 'END', '18601765', 'josephinewashington@aoglobelife.com', '+13165260873', 'Barbara', 'James', 'Veteran', '68.531', NULL, NULL, '2025-11-04 15:43:29.169+00'),
('28773', '409', 'END', '18612165', 'josephinewashington@aoglobelife.com', '+13166014835', 'Carl', 'Holley', 'Veteran', '79.164', NULL, NULL, '2025-11-04 15:41:29.169+00'),
('28770', '409', 'END', '18628621', 'josephinewashington@aoglobelife.com', '+13163692175', 'Kenneth', 'Smith', 'Veteran', '137.531', NULL, NULL, '2025-11-04 15:39:29.169+00'),
('28693', '198033', 'END', '18637323', 'jessicabrown@aoglobelife.com', '+16204483408', 'Raymond', 'Oliphant', 'Veteran', '125.364', NULL, NULL, '2025-11-04 15:17:29.205+00'),
('28682', '409', 'END', '18637993', 'josephinewashington@aoglobelife.com', '+13164410735', 'Billy', 'Trotter', 'Veteran', '36.965', NULL, NULL, '2025-11-04 15:13:29.203+00'),
('28679', '409', 'END', '18638099', 'josephinewashington@aoglobelife.com', '+13165318776', 'Christine', 'Byers', 'Veteran', '159.231', NULL, NULL, '2025-11-04 15:11:29.213+00'),
('28676', '409', 'END', '18638051', 'josephinewashington@aoglobelife.com', '+13164121275', 'Kevin', 'Coats', 'Veteran', '134.664', NULL, NULL, '2025-11-04 15:09:29.22+00'),
('28673', '409', 'END', '18581781', 'josephinewashington@aoglobelife.com', '+13166015806', 'Donald', 'Horton', 'Veteran', '78.964', NULL, NULL, '2025-11-04 15:07:29.22+00'),
('28668', '126829', 'END', '18639712', 'brandihernandez@aoglobelife.com', '+14056062604', 'Michael', 'Bonner', 'Veteran', '42.032', NULL, NULL, '2025-11-04 15:05:29.237+00'),
('28667', '203499', 'END', '18499965', 'cindysheppard@aoglobelife.com', '+19569282069', 'Miriam', 'Siller', 'Veteran', '157.765', NULL, NULL, '2025-11-04 15:05:29.237+00'),
('28662', '213793', 'END', '18633187', 'thomasgrant@aoglobelife.com', '+15715169770', 'Iva', 'Darden', 'Veteran', '98.231', NULL, NULL, '2025-11-04 15:03:29.237+00'),
('28661', '213793', 'END', '18633187', 'thomasgrant@aoglobelife.com', '+15715169770', 'Iva', 'Darden', 'Veteran', '', NULL, NULL, '2025-11-04 15:03:28.443+00'),
('28657', '213793', 'END', '18608580', 'thomasgrant@aoglobelife.com', '+17032051890', 'Craig', 'Brown', 'Veteran', '171.598', NULL, NULL, '2025-11-04 15:01:29.237+00'),
('28656', '213793', 'END', '18608580', 'thomasgrant@aoglobelife.com', '+17032051890', 'Craig', 'Brown', 'Veteran', '', NULL, NULL, '2025-11-04 15:01:28.438+00'),
('28653', '409', 'END', '18629057', 'josephinewashington@aoglobelife.com', '+13164402108', 'Alina', 'Diaz', 'Veteran', '58.631', NULL, NULL, '2025-11-04 14:59:29.255+00'),
('28648', '159521', 'END', '18628979', 'stephaniesmith@aoglobelife.com', '+18303809904', 'Janet', 'Young', 'Veteran', '93.331', NULL, NULL, '2025-11-04 14:57:29.255+00'),
('28647', '159521', 'END', '18628979', 'stephaniesmith@aoglobelife.com', '+18303809904', 'Janet', 'Young', 'Veteran', '', NULL, NULL, '2025-11-04 14:57:28.418+00'),
('28630', '185556', 'END', '18639990', 'oliviavargas@aoglobelife.com', '+15703817607', 'Margie', 'Shover', 'Veteran', '99.231', NULL, NULL, '2025-11-04 14:51:29.263+00'),
('28627', '213793', 'END', '18610517', 'thomasgrant@aoglobelife.com', '+17037890960', 'Louise', 'Woods', 'Veteran', '72.264', NULL, NULL, '2025-11-04 14:49:29.272+00'),
('28622', '213793', 'END', '18630120', 'thomasgrant@aoglobelife.com', '+17033680625', 'James', 'King', 'Veteran', '148.031', NULL, NULL, '2025-11-04 14:47:29.272+00'),
('28621', '213793', 'END', '18630120', 'thomasgrant@aoglobelife.com', '+17033680625', 'James', 'King', 'Veteran', '', NULL, NULL, '2025-11-04 14:47:28.458+00'),
('28620', '200869', 'END', '18638414', 'ashleybradley@aoglobelife.com', '+17122582336', 'Lois', 'Salley', 'Veteran', '95.531', NULL, NULL, '2025-11-04 14:47:29.28+00'),
('28608', '159521', 'END', '18639834', 'stephaniesmith@aoglobelife.com', '+19564730734', 'Gregory', 'Garcia', 'Veteran', '134.565', NULL, NULL, '2025-11-04 14:41:29.28+00'),
('28604', '155251', 'END', '18590580', 'carmenpierce@aoglobelife.com', '+14104571707', 'Jennifer', 'Thompson', 'Veteran', '66.098', NULL, NULL, '2025-11-04 14:39:29.297+00'),
('28602', '155251', 'END', '18590580', 'carmenpierce@aoglobelife.com', '+14104571707', 'Jennifer', 'Thompson', 'Veteran', '', NULL, NULL, '2025-11-04 14:39:28.502+00'),
('28598', '155251', 'END', '18607493', 'carmenpierce@aoglobelife.com', '+14105396929', 'Howard', 'Eason', 'Veteran', '82.731', NULL, NULL, '2025-11-04 14:37:29.297+00'),
('28596', '155251', 'END', '18607493', 'carmenpierce@aoglobelife.com', '+14105396929', 'Howard', 'Eason', 'Veteran', '', NULL, NULL, '2025-11-04 14:37:28.482+00'),
('28593', '155251', 'END', '18629579', 'carmenpierce@aoglobelife.com', '+14437088208', 'Alfred', 'Battle', 'Veteran', '69.197', NULL, NULL, '2025-11-04 14:35:29.297+00'),
('28590', '200869', 'END', '18638026', 'ashleybradley@aoglobelife.com', '+17122853434', 'Clarence', 'Cox', 'Veteran', '64.998', NULL, NULL, '2025-11-04 14:33:29.297+00'),
('28585', '205226', 'END', '18635944', 'melissawilson@aoglobelife.com', '+14402462330', 'Earl', 'Devericks', 'Veteran', '150.932', NULL, NULL, '2025-11-04 14:31:29.305+00'),
('28582', '205226', 'END', '18601628', 'melissawilson@aoglobelife.com', '+14404252969', 'Jerry', 'Ware', 'Veteran', '125.098', NULL, NULL, '2025-11-04 14:29:29.314+00'),
('28581', '205226', 'END', '18601628', 'melissawilson@aoglobelife.com', '+14404252969', 'Jerry', 'Ware', 'Veteran', '', NULL, NULL, '2025-11-04 14:29:28.519+00'),
('28191', '203499', 'END', '18629383', 'cindysheppard@aoglobelife.com', '+19567212089', 'Maria', 'Robles', 'Veteran', '162.131', NULL, NULL, '2025-11-04 13:13:29.504+00'),
('28192', '203499', 'END', '18629383', 'cindysheppard@aoglobelife.com', '+19567212089', 'Maria', 'Robles', 'Veteran', '', NULL, NULL, '2025-11-04 13:13:28.623+00'),
('28433', '203499', 'END', '18630260', 'cindysheppard@aoglobelife.com', '+19566300779', 'Richard', 'Almarez', 'Veteran', '41.965', NULL, NULL, '2025-11-04 16:30:50.179+00'),
('28438', '203499', 'END', '18630070', 'cindysheppard@aoglobelife.com', '+15122455407', 'Francisco', 'Delarosa', 'Veteran', '65.365', NULL, NULL, '2025-11-04 16:32:50.187+00'),
('28439', '203499', 'END', '18630070', 'cindysheppard@aoglobelife.com', '+15122455407', 'Francisco', 'Delarosa', 'Veteran', '', NULL, NULL, '2025-11-04 16:32:49.387+00'),
('28446', '203499', 'END', '18610222', 'cindysheppard@aoglobelife.com', '+12104327673', 'Francisca', 'Cuellar', 'Veteran', '129.131', NULL, NULL, '2025-11-04 16:34:50.195+00'),
('28636', '203499', 'END', '18588680', 'cindysheppard@aoglobelife.com', '+19568443974', 'Maria', 'Bejarano', 'Veteran', '136.265', NULL, NULL, '2025-11-04 14:53:29.263+00'),
('28637', '203499', 'END', '18588680', 'cindysheppard@aoglobelife.com', '+19568443974', 'Maria', 'Bejarano', 'Veteran', '', NULL, NULL, '2025-11-04 14:53:28.452+00'),
('28642', '203499', 'END', '18599367', 'cindysheppard@aoglobelife.com', '+19564430780', 'Lena', 'Cortinas', 'Veteran', '198.431', NULL, NULL, '2025-11-04 14:55:29.263+00'),
('28649', '203499', 'END', '18597375', 'cindysheppard@aoglobelife.com', '+19568842949', 'Michael', 'Garcia', 'Veteran', '138.265', NULL, NULL, '2025-11-04 14:57:29.255+00'),
('28650', '203499', 'END', '18597375', 'cindysheppard@aoglobelife.com', '+19568842949', 'Michael', 'Garcia', 'Veteran', '', NULL, NULL, '2025-11-04 14:57:28.449+00'),
('28742', '203499', 'END', '18597928', 'cindysheppard@aoglobelife.com', '+19563783778', 'Helen', 'Tamez', 'Veteran', '90.565', NULL, NULL, '2025-11-04 15:33:29.176+00'),
('28743', '203499', 'END', '18597928', 'cindysheppard@aoglobelife.com', '+19563783778', 'Helen', 'Tamez', 'Veteran', '', NULL, NULL, '2025-11-04 15:33:28.327+00'),
('28706', '95059', 'END', '18605257', 'richiealtig@aoglobelife.com', '+14796361267', 'Diane', 'Morrison', 'Veteran', '67.898', NULL, NULL, '2025-11-04 15:21:29.197+00'),
('28706', '95059', 'END', '18605257', 'richiealtig@aoglobelife.com', '+14796361267', 'Diane', 'Morrison', 'Veteran', '', NULL, NULL, '2025-11-04 15:21:28.283+00'),
('28703', '95059', 'END', '18601237', 'richiealtig@aoglobelife.com', '+14694011002', 'Teresa', 'Johnson', 'Veteran', '144.264', NULL, NULL, '2025-11-04 15:19:29.197+00'),
('28702', '95059', 'END', '18601237', 'richiealtig@aoglobelife.com', '+14694011002', 'Teresa', 'Johnson', 'Veteran', '', NULL, NULL, '2025-11-04 15:19:28.369+00'),
('28707', '95059', 'END', '18610235', 'richiealtig@aoglobelife.com', '+19728751330', 'William', 'Perez', 'Veteran', '71.698', NULL, NULL, '2025-11-04 15:21:29.197+00'),
('28707', '95059', 'END', '18610235', 'richiealtig@aoglobelife.com', '+19728751330', 'William', 'Perez', 'Veteran', '', NULL, NULL, '2025-11-04 15:21:28.368+00'),
('28714', '95059', 'END', '18630136', 'richiealtig@aoglobelife.com', '+18172448959', 'Shirley', 'Sullivan', 'Veteran', '165.598', NULL, NULL, '2025-11-04 15:25:29.189+00'),
('28714', '95059', 'END', '18630136', 'richiealtig@aoglobelife.com', '+18172448959', 'Shirley', 'Sullivan', 'Veteran', '', NULL, NULL, '2025-11-04 15:25:28.772+00'),
('28721', '203499', 'END', '18630197', 'cindysheppard@aoglobelife.com', '+19569939802', 'Maria', 'Mendoza', 'Veteran', '97.398', NULL, NULL, '2025-11-04 15:27:29.189+00'),
('28721', '203499', 'END', '18630197', 'cindysheppard@aoglobelife.com', '+19569939802', 'Maria', 'Mendoza', 'Veteran', '', NULL, NULL, '2025-11-04 15:27:28.388+00'),
('28722', '203499', 'END', '18630197', 'cindysheppard@aoglobelife.com', '+19569939802', 'Maria', 'Mendoza', 'Veteran', '', NULL, NULL, '2025-11-04 15:27:28.388+00'),
('28722', '203499', 'END', '18630197', 'cindysheppard@aoglobelife.com', '+19569939802', 'Maria', 'Mendoza', 'Veteran', '97.398', NULL, NULL, '2025-11-04 15:27:29.189+00'),
('28724', '95059', 'END', '18587448', 'richiealtig@aoglobelife.com', '+14798026686', 'Norman', 'Lisle', 'Veteran', '157.565', NULL, NULL, '2025-11-04 15:29:29.189+00'),
('28724', '95059', 'END', '18587448', 'richiealtig@aoglobelife.com', '+14798026686', 'Norman', 'Lisle', 'Veteran', '', NULL, NULL, '2025-11-04 15:29:28.35+00'),
('28725', '95059', 'END', '18587448', 'richiealtig@aoglobelife.com', '+14798026686', 'Norman', 'Lisle', 'Veteran', '', NULL, NULL, '2025-11-04 15:29:28.35+00'),
('28730', '203499', 'END', '18591754', 'cindysheppard@aoglobelife.com', '+19566373506', 'Jesus', 'Zapata', 'Veteran', '40.231', NULL, NULL, '2025-11-04 15:31:29.176+00'),
('28733', '174701', 'END', '18548397', 'susannahart@aoglobelife.com', '+17087226628', 'Nathaniel', 'Williams', 'Veteran', '96.198', NULL, NULL, '2025-11-04 15:31:29.176+00'),
('28733', '174701', 'END', '18548397', 'susannahart@aoglobelife.com', '+17087226628', 'Nathaniel', 'Williams', 'Veteran', '', NULL, NULL, '2025-11-04 15:31:28.384+00'),
('28734', '174701', 'END', '18591691', 'susannahart@aoglobelife.com', '+17732779370', 'Joyce', 'Bolden', 'Veteran', '152.998', NULL, NULL, '2025-11-04 15:31:29.176+00'),
('28734', '174701', 'END', '18591691', 'susannahart@aoglobelife.com', '+17732779370', 'Joyce', 'Bolden', 'Veteran', '', NULL, NULL, '2025-11-04 15:31:28.37+00'),
('28751', '131250', 'END', '18635780', 'biyancadeanda@aoglobelife.com', '+19167919704', 'Harriett', 'Fleming', 'Veteran', '154.798', NULL, NULL, '2025-11-04 15:37:29.168+00'),
('28752', '145691', 'END', '18632076', NULL, '+19198728230', 'Robert', 'Spivey', 'Veteran', '87.598', NULL, NULL, '2025-11-04 15:37:29.168+00'),
('28755', '145691', 'END', '18588804', NULL, '+19198736027', 'John', 'Barnett', 'Veteran', '197.298', NULL, NULL, '2025-11-04 15:39:29.168+00'),
('28758', '209153', 'END', '18632681', 'lucyoliva@aoglobelife.com', '+19728644404', 'Frank', 'Mendoza', 'Veteran', '34.365', NULL, NULL, '2025-11-04 15:41:29.169+00'),
('28758', '209153', 'END', '18632681', 'lucyoliva@aoglobelife.com', '+19728644404', 'Frank', 'Mendoza', 'Veteran', '', NULL, NULL, '2025-11-04 15:41:28.345+00'),
('28759', '209153', 'END', '18632681', 'lucyoliva@aoglobelife.com', '+19728644404', 'Frank', 'Mendoza', 'Veteran', '', NULL, NULL, '2025-11-04 15:41:28.345+00'),
('28764', '198033', 'END', '18641149', 'jessicabrown@aoglobelife.com', '+16204386636', 'Willie', 'Bratcher', 'Veteran', '82.431', NULL, NULL, '2025-11-04 15:43:29.169+00'),
('28767', '198033', 'END', '18641149', 'jessicabrown@aoglobelife.com', '+16204386636', 'Willie', 'Bratcher', 'Veteran', '', NULL, NULL, '2025-11-04 15:43:28.349+00'),
('28773', '409', 'END', '18612165', 'josephinewashington@aoglobelife.com', '+13166014835', 'Carl', 'Holley', 'Veteran', '79.164', NULL, NULL, '2025-11-04 15:41:29.169+00'),
('28773', '409', 'END', '18612165', 'josephinewashington@aoglobelife.com', '+13166014835', 'Carl', 'Holley', 'Veteran', '', NULL, NULL, '2025-11-04 15:41:28.369+00'),
('28776', '409', 'END', '18601765', 'josephinewashington@aoglobelife.com', '+13165260873', 'Barbara', 'James', 'Veteran', '68.531', NULL, NULL, '2025-11-04 15:43:29.169+00'),
('28776', '409', 'END', '18601765', 'josephinewashington@aoglobelife.com', '+13165260873', 'Barbara', 'James', 'Veteran', '', NULL, NULL, '2025-11-04 15:43:28.355+00'),
('28786', '409', 'END', '18640353', 'josephinewashington@aoglobelife.com', '+13166066085', 'Mary', 'Perez', 'Veteran', '105.531', NULL, NULL, '2025-11-04 15:47:29.152+00'),
('28789', '409', 'END', '18638067', 'josephinewashington@aoglobelife.com', '+13162648686', 'Melissa', 'Smith', 'Veteran', '50.398', NULL, NULL, '2025-11-04 15:49:29.152+00'),
('28794', '197159', 'END', '18610830', 'anitaruiz@aoglobelife.com', '+19712971333', 'Mary', 'Murray', 'Veteran', '174.365', NULL, NULL, '2025-11-04 15:51:29.16+00'),
('28795', '409', 'END', '18581781', 'josephinewashington@aoglobelife.com', '+13166015806', 'Donald', 'Horton', 'Veteran', '78.964', NULL, NULL, '2025-11-04 15:07:29.22+00'),
('28803', '206353', 'END', '18590042', 'heatherschmidt@aoglobelife.com', '+17327873836', 'Nancy', 'Snead', 'Veteran', '153.531', NULL, NULL, '2025-11-04 15:53:29.135+00'),
('28803', '206353', 'END', '18590042', 'heatherschmidt@aoglobelife.com', '+17327873836', 'Nancy', 'Snead', 'Veteran', '', NULL, NULL, '2025-11-04 15:53:28.32+00'),
('28804', '206353', 'END', '18590263', 'heatherschmidt@aoglobelife.com', '+18624428333', 'Joseph', 'Brito', 'Veteran', '110.298', NULL, NULL, '2025-11-04 15:53:29.135+00'),
('28804', '206353', 'END', '18590263', 'heatherschmidt@aoglobelife.com', '+18624428333', 'Joseph', 'Brito', 'Veteran', '', NULL, NULL, '2025-11-04 15:53:28.32+00'),
('28534', '131252', 'END', '18631449', 'patriciasantamarina@aoglobelife.com', '+16025072891', 'Gary', 'Haley', 'Veteran', '401.224', NULL, NULL, '2025-11-04 16:56:32.827+00'),
('28534', '131252', 'END', '18631449', 'patriciasantamarina@aoglobelife.com', '+16025072891', 'Gary', 'Haley', 'Veteran', '', NULL, NULL, '2025-11-04 16:56:32.026+00'),
('28535', '131252', 'END', '18631449', 'patriciasantamarina@aoglobelife.com', '+16025072891', 'Gary', 'Haley', 'Veteran', '', NULL, NULL, '2025-11-04 16:56:32.026+00'),
('28535', '131252', 'END', '18631449', 'patriciasantamarina@aoglobelife.com', '+16025072891', 'Gary', 'Haley', 'Veteran', '401.224', NULL, NULL, '2025-11-04 16:56:32.827+00'),
('28562', '131252', 'END', '18637594', 'patriciasantamarina@aoglobelife.com', '+13089911704', 'Theresa', 'Medina', 'Veteran', '251.054', NULL, NULL, '2025-11-04 17:01:03.853+00'),
('28330', '131252', 'END', '18636687', 'patriciasantamarina@aoglobelife.com', '+18584806859', 'Mary', 'Mitchell', 'Veteran', '754.895', NULL, NULL, '2025-11-04 16:11:26.768+00'),
('28330', '131252', 'END', '18636687', 'patriciasantamarina@aoglobelife.com', '+18584806859', 'Mary', 'Mitchell', 'Veteran', '', NULL, NULL, '2025-11-04 16:11:25.971+00'),
('29014', '131252', 'END', '18600515', 'patriciasantamarina@aoglobelife.com', '+19064935144', 'Nancy', 'Mielke', 'Veteran', '666.084', NULL, NULL, '2025-11-04 18:04:13.833+00'),
('29014', '131252', 'END', '18600515', 'patriciasantamarina@aoglobelife.com', '+19064935144', 'Nancy', 'Mielke', 'Veteran', '', NULL, NULL, '2025-11-04 18:04:13.031+00'),
('27376', '197159', 'END', '18593391', 'anitaruiz@aoglobelife.com', '+12536372433', 'Brian', 'Belcher', 'Veteran', '47.998', NULL, NULL, '2025-11-04 14:39:29.728+00'),
('27376', '197159', 'END', '18593391', 'anitaruiz@aoglobelife.com', '+12536372433', 'Brian', 'Belcher', 'Veteran', '', NULL, NULL, '2025-11-04 14:39:28.91+00'),
('27377', '197159', 'END', '18593391', 'anitaruiz@aoglobelife.com', '+12536372433', 'Brian', 'Belcher', 'Veteran', '47.998', NULL, NULL, '2025-11-04 14:39:29.728+00'),
('27377', '197159', 'END', '18593391', 'anitaruiz@aoglobelife.com', '+12536372433', 'Brian', 'Belcher', 'Veteran', '', NULL, NULL, '2025-11-04 14:39:28.91+00'),
('28798', '197159', 'END', '18610830', 'anitaruiz@aoglobelife.com', '+19712971333', 'Mary', 'Murray', 'Veteran', '174.365', NULL, NULL, '2025-11-04 15:51:29.16+00'),
('28798', '197159', 'END', '18610830', 'anitaruiz@aoglobelife.com', '+19712971333', 'Mary', 'Murray', 'Veteran', '', NULL, NULL, '2025-11-04 15:51:28.353+00'),
('28799', '197159', 'END', '18610830', 'anitaruiz@aoglobelife.com', '+19712971333', 'Mary', 'Murray', 'Veteran', '174.365', NULL, NULL, '2025-11-04 15:51:29.16+00'),
('28799', '197159', 'END', '18610830', 'anitaruiz@aoglobelife.com', '+19712971333', 'Mary', 'Murray', 'Veteran', '', NULL, NULL, '2025-11-04 15:51:28.353+00')
`;

// Extract data: id, leadid, agent, email
const lines = insertData.trim().split('\n').filter(l => l.trim() && l.includes("('"));

const calls = [];
lines.forEach(line => {
  const match = line.match(/\('(\d+)',\s*'(\d+)',\s*'[^']+',\s*'(\d+)',\s*(NULL|'([^']+)'),/);
  if (match) {
    const [_, id, agent, leadid, nullOrEmail, email] = match;
    calls.push({
      id,
      agent,
      leadid,
      email: email || null
    });
  }
});

// Group by leadid
const byLead = {};
calls.forEach(call => {
  if (!byLead[call.leadid]) {
    byLead[call.leadid] = [];
  }
  byLead[call.leadid].push(call);
});

// Count duplicates by email
const duplicatesByEmail = {};
Object.keys(byLead).forEach(leadid => {
  const leadCalls = byLead[leadid];
  if (leadCalls.length > 1) {
    leadCalls.forEach(call => {
      const email = call.email || `agent-${call.agent}`;
      if (!duplicatesByEmail[email]) {
        duplicatesByEmail[email] = 0;
      }
      duplicatesByEmail[email] += 1;
    });
  }
});

console.log('📊 DUPLICATE VDP CALLS BY AGENT EMAIL:\n');
Object.keys(duplicatesByEmail)
  .sort((a, b) => duplicatesByEmail[b] - duplicatesByEmail[a])
  .forEach(email => {
    console.log(`${email}: ${duplicatesByEmail[email]} duplicate entries`);
  });

const total = Object.values(duplicatesByEmail).reduce((sum, count) => sum + count, 0);
console.log(`\n📈 TOTAL DUPLICATE ENTRIES: ${total}`);

