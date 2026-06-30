/**
 * wrappers/index.ts — re-export تمام contract wrapperها از build artifacts
 */

/* ── CropManager ─────────────────────────────────────────────── */
export {
  CropManager,
  storeRegisterLand,   loadRegisterLand,
  storePlantCrop,      loadPlantCrop,
  storeHarvestCrop,    loadHarvestCrop,
  storeRepairTools,    loadRepairTools,
  storeSetSAPMaster,   loadSetSAPMaster,
  storeCropState,      loadCropState,
  type RegisterLand,
  type PlantCrop,
  type HarvestCrop,
  type RepairTools,
  type SetSAPMaster,
  type CropState,
} from "../build/CropManager/CropManager_CropManager";

/* ── SAPJettonMaster ─────────────────────────────────────────── */
export {
  SAPJettonMaster,
  storeMintTo,          loadMintTo,
  storeSetGameContract, loadSetGameContract,
  storeSetMintable,     loadSetMintable,
  storeBurnPool,        loadBurnPool,
  type MintTo,
  type SetGameContract,
  type SetMintable,
  type BurnPool,
} from "../build/SAP/SAPJettonMaster_SAPJettonMaster";

/* ── LandCollection ──────────────────────────────────────────── */
export {
  LandCollection,
  storeMintLand,      loadMintLand,
  storeBuyLand,       loadBuyLand,
  type MintLand,
  type BuyLand,
} from "../build/LandNFT/LandCollection_LandCollection";

/* ── LandItem (NFT item contract) ────────────────────────────── */
export {
  LandItem,
} from "../build/LandNFT/LandCollection_LandItem";
