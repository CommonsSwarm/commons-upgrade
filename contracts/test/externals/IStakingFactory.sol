pragma solidity 0.4.24;

import "./IStaking.sol";

contract IStakingFactory {
    function getOrCreateInstance(
        /* ERC20 */
        address token
    ) external returns (IStaking);

    function existsInstance(
        /* ERC20 */
        address token
    ) external view returns (bool);

    function getInstance(
        /* ERC20 */
        address token
    ) external view returns (IStaking);
}
