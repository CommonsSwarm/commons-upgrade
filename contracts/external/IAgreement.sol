pragma solidity 0.4.24;

import "@aragon/os/contracts/lib/token/ERC20.sol";
import "./IStakingFactory.sol";

contract IAgreement {
    function CHANGE_AGREEMENT_ROLE() external pure returns (bytes32);

    function MANAGE_DISPUTABLE_ROLE() external pure returns (bytes32);

    IStakingFactory public stakingFactory;

    function initialize(
        address _arbitrator,
        bool _setAppFeesCashier,
        string _title,
        bytes _content,
        address _stakingFactory
    ) external;

    function activate(
        address _disputableAddress,
        address _collateralToken,
        uint64 _challengeDuration,
        uint256 _actionAmount,
        uint256 _challengeAmount
    ) external;

    function getCollateralRequirement(
        address _disputable,
        uint256 _collateralRequirementId
    )
        external
        view
        returns (
            ERC20,
            uint64,
            uint256,
            uint256
        );
}
